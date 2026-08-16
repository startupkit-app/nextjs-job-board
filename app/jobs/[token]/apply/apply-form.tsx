"use client";

import Link from "next/link";
import {
  startTransition,
  useActionState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { FileUpload } from "@/components/file-upload";
import { Turnstile } from "@/components/turnstile";
import type { ApplicationForm, FormField, Question } from "@/lib/kit";
import type { FieldErrors } from "@/lib/kit-errors";
import { submitApplication, type ApplyState } from "./actions";
import {
  buildRules,
  controlId,
  CORE_FIELD_NAMES,
  RESERVED_FIELD_NAMES,
  RESUME_INPUT_NAME,
  RESUME_LABEL,
  summaryHeading,
  validateForm,
  validateValue,
  type Rule,
} from "./validation";

type FormState = ApplyState & {
  /**
   * Bumped only when the API itself rejected us. A Turnstile token is spent by
   * the request that carried it, so the widget needs a fresh one — but a
   * rejection we produced in the browser never sent it, and re-solving the
   * challenge for that would be a punishment for a typo.
   */
  turnstileKey?: number;
  /** What each control held at submit time, so a corrected field can clear its error. */
  submitted?: Record<string, string>;
};

const INITIAL_STATE: FormState = { status: "idle" };
const NO_ERRORS: FieldErrors = {};

const DEFAULT_CORE_FIELDS: Record<(typeof CORE_FIELD_NAMES)[number], FormField> = {
  first_name: { name: "first_name", type: "text", label: "First name", required: true },
  last_name: { name: "last_name", type: "text", label: "Last name", required: true },
  email: { name: "email", type: "email", label: "Email", required: true },
  phone: { name: "phone", type: "phone", label: "Phone", required: false },
};

export function ApplyForm({
  token,
  jobTitle,
  form,
}: {
  token: string;
  jobTitle: string;
  form: ApplicationForm;
}) {
  const coreFields = useMemo(
    () =>
      CORE_FIELD_NAMES.map(
        (name) => form.fields.find((field) => field.name === name) ?? DEFAULT_CORE_FIELDS[name]
      ),
    [form.fields]
  );
  // "resume" is rendered by the dedicated uploader below (submitted as
  // resume_signed_id), so keep it out of the generic "extra fields" list to
  // avoid a duplicate uploader that the API would silently ignore.
  const extraFields = useMemo(
    () => form.fields.filter((field) => !RESERVED_FIELD_NAMES.includes(field.name)),
    [form.fields]
  );
  const rules = useMemo(() => buildRules(form, coreFields), [form, coreFields]);
  const rulesByKey = useMemo(
    () => new Map<string, Rule>(rules.map((rule) => [rule.errorKey, rule])),
    [rules]
  );

  // Every control is controlled, so a rejected submission cannot leave the DOM
  // holding values React no longer knows about.
  const [values, setValues] = useState<Record<string, string>>({});
  const serverErrors = useRef(0);
  const summaryRef = useRef<HTMLDivElement>(null);

  const action = useCallback(
    async (previous: FormState, formData: FormData): Promise<FormState> => {
      const { errors: clientErrors, submitted } = validateForm(formData, rules);
      const count = Object.keys(clientErrors).length;
      if (count > 0) {
        // Rejected without touching the network.
        return {
          status: "error",
          message: summaryHeading(count),
          fieldErrors: clientErrors,
          turnstileKey: serverErrors.current,
          submitted,
        };
      }

      const result = await submitApplication(token, previous, formData);
      if (result.status === "error") serverErrors.current += 1;
      return { ...result, turnstileKey: serverErrors.current, submitted };
    },
    [rules, token]
  );

  const [state, formAction, isPending] = useActionState(action, INITIAL_STATE);

  /**
   * Dispatched by hand rather than through `<form action={…}>`. React resets
   * every field once an `action` prop settles — including on a rejection — and
   * while it restores text inputs from `defaultValue`, it does not restore a
   * <select>, a checkbox or a radio: their rendered value is unchanged, so
   * React sees nothing to repaint and the DOM keeps the reset. Dispatching
   * inside a transition keeps reset control here, where we never ask for one.
   */
  const handleSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const formData = new FormData(event.currentTarget);
      startTransition(() => formAction(formData));
    },
    [formAction]
  );

  // A11y: one alert region is the single focus target on failure. Focusing the
  // first `[aria-invalid="true"]` instead would match the <fieldset> wrapping a
  // radio group, which is not focusable — focus would fall to <body>.
  useEffect(() => {
    if (state.status !== "error") return;
    const summary = summaryRef.current;
    if (!summary) return;
    summary.focus({ preventScroll: true });
    summary.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
      block: "center",
    });
  }, [state]);

  const handleChange = useCallback((inputName: string, next: string) => {
    setValues((previous) => ({ ...previous, [inputName]: next }));
  }, []);

  if (state.status === "success") {
    return <SuccessPanel jobTitle={jobTitle} applicationId={state.applicationId} />;
  }

  // An error stays on screen until the applicant has both changed that value
  // and made it valid — so it never vanishes on arrival, and never lingers once
  // corrected. Derived from (state, values); nothing to reset between attempts.
  // Skipped entirely before the first submit, which is where most keystrokes are.
  let errors: FieldErrors = NO_ERRORS;
  let summaryItems: { key: string; message: string; rule?: Rule }[] = [];

  if (state.status === "error") {
    const submitted = state.submitted ?? {};
    const live: FieldErrors = {};
    for (const [key, message] of Object.entries(state.fieldErrors ?? {})) {
      const rule = rulesByKey.get(key);
      if (rule) {
        const current = values[rule.inputName] ?? "";
        const changed = current !== (submitted[rule.inputName] ?? "");
        if (changed && !validateValue(rule, current)) continue;
      }
      live[key] = message;
    }
    errors = live;

    // Ordered to match the form, so the summary reads top-to-bottom. Keys the
    // API returned that match no control still get listed, just without a link.
    summaryItems = [
      ...rules
        .filter((rule) => live[rule.errorKey])
        .map((rule) => ({ key: rule.errorKey, message: live[rule.errorKey], rule })),
      ...Object.keys(live)
        .filter((key) => !rulesByKey.has(key))
        .map((key) => ({ key, message: live[key] })),
    ];
  }

  const turnstileSitekey = form.turnstile.sitekey || process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || null;

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-7">
      {state.status === "error" && (
        <div
          ref={summaryRef}
          tabIndex={-1}
          role="alert"
          className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
        >
          <p className="font-semibold">{state.message}</p>
          {summaryItems.length > 0 && (
            <ul className="mt-2.5 space-y-1.5">
              {summaryItems.map((item) => {
                const text = `${item.rule ? `${item.rule.label} — ` : ""}${item.message}`;
                // The uploader owns its own generated id, so a file error is
                // listed but not linked.
                const href =
                  item.rule && item.rule.kind !== "file"
                    ? `#${controlId(item.rule.inputName)}`
                    : undefined;
                return (
                  <li key={item.key}>
                    {href ? (
                      <a
                        href={href}
                        className="underline underline-offset-2 hover:text-red-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 dark:hover:text-red-100"
                      >
                        {text}
                      </a>
                    ) : (
                      text
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      <fieldset className="space-y-5">
        <legend className="text-base font-semibold">Contact details</legend>
        <div className="grid content-start gap-5 sm:grid-cols-2">
          {coreFields.map((field, index) => (
            <FieldControl
              key={field.name}
              field={field}
              inputName={field.name}
              value={values[field.name] ?? ""}
              onValueChange={handleChange}
              error={errors[field.name]}
              autoFocus={index === 0 && state.status === "idle"}
            />
          ))}
        </div>
      </fieldset>

      <FileUpload
        name={RESUME_INPUT_NAME}
        label={RESUME_LABEL}
        required={form.resume.required}
        contentTypes={form.resume.content_types}
        maxByteSize={form.resume.max_byte_size}
        serverError={errors.resume ?? errors.resume_signed_id}
      />

      {extraFields.length > 0 && (
        <fieldset className="space-y-5">
          <legend className="text-base font-semibold">Additional information</legend>
          {extraFields.map((field) =>
            field.type === "file" ? (
              <FileUpload
                key={field.name}
                name={`file:${field.name}`}
                label={field.label}
                required={field.required}
                serverError={errors[field.name]}
              />
            ) : (
              <FieldControl
                key={field.name}
                field={field}
                inputName={`field:${field.name}`}
                value={values[`field:${field.name}`] ?? ""}
                onValueChange={handleChange}
                error={errors[field.name]}
              />
            )
          )}
        </fieldset>
      )}

      {form.questions.length > 0 && (
        <fieldset className="space-y-6">
          <legend className="text-base font-semibold">Questions</legend>
          {form.questions.map((question) => (
            <QuestionControl
              key={question.key}
              question={question}
              value={values[`question:${question.key}`] ?? ""}
              onValueChange={handleChange}
              error={errors[question.key]}
            />
          ))}
        </fieldset>
      )}

      {form.consent_disclosure_html && (
        <div
          className="job-description rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-xs dark:border-zinc-800 dark:bg-zinc-900"
          // Server-sanitized at the data boundary (lib/sanitize.ts) before this prop is passed in.
          dangerouslySetInnerHTML={{ __html: form.consent_disclosure_html }}
        />
      )}

      {turnstileSitekey ? (
        <Turnstile sitekey={turnstileSitekey} resetKey={state.turnstileKey} />
      ) : (
        form.turnstile.required && (
          <p className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
            This employer requires spam-protection verification, but no Turnstile site key is
            configured. Set <code className="font-mono text-xs">NEXT_PUBLIC_TURNSTILE_SITE_KEY</code>{" "}
            — submissions will be rejected until then.
          </p>
        )
      )}

      <div className="border-t border-zinc-200 pt-6 dark:border-zinc-800">
        {/* Stays enabled while invalid: disabling it removes the very mechanism
            that would explain why, and screen-reader users scanning by control
            would find a dead button with no stated cause. */}
        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-lg bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-wait disabled:opacity-60 sm:w-auto"
        >
          {isPending ? "Submitting…" : "Submit application"}
        </button>
        <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
          Fields marked with <span aria-hidden="true">*</span> are required.
        </p>
      </div>
    </form>
  );
}

// ─── Field renderer (all 8 FormField types) ───────────────────────────────────

const INPUT_TYPES: Partial<Record<FormField["type"], string>> = {
  text: "text",
  email: "email",
  phone: "tel",
  url: "url",
};

function FieldControl({
  field,
  inputName,
  value,
  onValueChange,
  error,
  autoFocus = false,
}: {
  field: FormField;
  inputName: string;
  value: string;
  onValueChange: (inputName: string, next: string) => void;
  error?: string;
  autoFocus?: boolean;
}) {
  const id = controlId(inputName);
  const describedBy = error ? `${id}-error` : undefined;
  const inputClass =
    "block w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-2 focus:outline-indigo-500/40 dark:bg-zinc-900 dark:text-zinc-100 " +
    (error
      ? "border-red-400 dark:border-red-700"
      : "border-zinc-300 focus:border-indigo-500 dark:border-zinc-700");

  const shared = {
    id,
    name: inputName,
    required: field.required,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": describedBy,
  };

  let control: React.ReactNode;
  switch (field.type) {
    case "textarea":
      control = (
        <textarea
          {...shared}
          rows={4}
          maxLength={field.max_length}
          placeholder={field.placeholder}
          value={value}
          onChange={(event) => onValueChange(inputName, event.target.value)}
          className={inputClass}
        />
      );
      break;

    case "select":
      control = (
        <select
          {...shared}
          value={value}
          onChange={(event) => onValueChange(inputName, event.target.value)}
          className={inputClass}
        >
          <option value="" disabled>
            {field.placeholder ?? "Select an option…"}
          </option>
          {(field.options ?? []).map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
      break;

    case "checkbox":
      return (
        <div className="sm:col-span-2">
          <label className="flex cursor-pointer items-start gap-2.5 text-sm text-zinc-700 dark:text-zinc-300">
            <input
              {...shared}
              type="checkbox"
              value="true"
              checked={value === "true"}
              onChange={(event) => onValueChange(inputName, event.target.checked ? "true" : "")}
              className="mt-0.5 size-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 dark:border-zinc-600"
            />
            <span>
              {field.label}
              <RequiredMark required={field.required} />
            </span>
          </label>
          <FieldError id={`${id}-error`} error={error} />
        </div>
      );

    default:
      // text, email, phone, url — plain inputs with matching HTML types.
      control = (
        <input
          {...shared}
          type={INPUT_TYPES[field.type] ?? "text"}
          maxLength={field.max_length}
          placeholder={field.placeholder}
          autoFocus={autoFocus}
          autoComplete={autoCompleteFor(field.name)}
          value={value}
          onChange={(event) => onValueChange(inputName, event.target.value)}
          className={inputClass}
        />
      );
  }

  return (
    <div className={field.type === "textarea" ? "sm:col-span-2" : undefined}>
      <label htmlFor={id} className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">
        {field.label}
        <RequiredMark required={field.required} />
      </label>
      <div className="mt-1.5">{control}</div>
      <FieldError id={`${id}-error`} error={error} />
    </div>
  );
}

// ─── Question renderer (text, scenario, multiple_choice) ─────────────────────

function QuestionControl({
  question,
  value,
  onValueChange,
  error,
}: {
  question: Question;
  value: string;
  onValueChange: (inputName: string, next: string) => void;
  error?: string;
}) {
  const inputName = `question:${question.key}`;
  const id = controlId(inputName);

  if (question.type === "multiple_choice") {
    return (
      <fieldset role="radiogroup" aria-describedby={error ? `${id}-error` : undefined}>
        <legend className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {question.prompt}
          <RequiredMark required={question.required} />
        </legend>
        <div className="mt-2.5 space-y-2">
          {(question.options ?? []).map((option, index) => (
            <label
              key={option}
              className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-zinc-200 px-3.5 py-2.5 text-sm text-zinc-700 has-checked:border-indigo-400 has-checked:bg-indigo-50 dark:border-zinc-700 dark:text-zinc-300 dark:has-checked:border-indigo-600 dark:has-checked:bg-indigo-950"
            >
              <input
                // The first radio carries the group's id so the error summary
                // has a focusable anchor target — a <fieldset> is not one.
                id={index === 0 ? id : undefined}
                type="radio"
                name={inputName}
                value={option}
                checked={value === option}
                onChange={() => onValueChange(inputName, option)}
                required={question.required}
                className="mt-0.5 size-4 border-zinc-300 text-indigo-600 focus:ring-indigo-500 dark:border-zinc-600"
              />
              {option}
            </label>
          ))}
        </div>
        <FieldError id={`${id}-error`} error={error} />
      </fieldset>
    );
  }

  return (
    <CountedTextarea
      name={inputName}
      label={question.prompt}
      required={question.required}
      maxLength={question.max_length}
      rows={question.type === "scenario" ? 7 : 4}
      value={value}
      onValueChange={onValueChange}
      error={error}
    />
  );
}

function CountedTextarea({
  name,
  label,
  required,
  maxLength,
  rows,
  value,
  onValueChange,
  error,
}: {
  name: string;
  label: string;
  required: boolean;
  maxLength: number;
  rows: number;
  value: string;
  onValueChange: (inputName: string, next: string) => void;
  error?: string;
}) {
  const id = controlId(name);
  const count = value.length;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {label}
          <RequiredMark required={required} />
        </label>
        {maxLength > 0 && (
          // Deliberately never red: the textarea hard-truncates at maxLength, so
          // reaching it is not an error, and colouring it like one would cry
          // wolf at the moment the applicant did nothing wrong.
          <span
            aria-hidden="true"
            className={`shrink-0 text-xs tabular-nums ${
              count >= maxLength * 0.9
                ? "font-medium text-zinc-700 dark:text-zinc-300"
                : "text-zinc-400 dark:text-zinc-500"
            }`}
          >
            {count}/{maxLength}
          </span>
        )}
      </div>
      <textarea
        id={id}
        name={name}
        required={required}
        rows={rows}
        maxLength={maxLength > 0 ? maxLength : undefined}
        value={value}
        onChange={(event) => onValueChange(name, event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`mt-1.5 block w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-2 focus:outline-indigo-500/40 dark:bg-zinc-900 dark:text-zinc-100 ${
          error
            ? "border-red-400 dark:border-red-700"
            : "border-zinc-300 focus:border-indigo-500 dark:border-zinc-700"
        }`}
      />
      <FieldError id={`${id}-error`} error={error} />
    </div>
  );
}

// ─── Bits ─────────────────────────────────────────────────────────────────────

function RequiredMark({ required }: { required: boolean }) {
  if (!required) return null;
  // Muted, not red: a pristine twelve-field form was speckled red before the
  // applicant had done anything wrong, which left nothing to escalate to once
  // real errors also rendered in red.
  return (
    <span aria-hidden="true" className="ml-0.5 text-zinc-400 dark:text-zinc-500">
      *
    </span>
  );
}

function FieldError({ id, error }: { id: string; error?: string }) {
  if (!error) return null;
  // Plain text, not role="alert": the summary above is the one live region, and
  // fifteen simultaneous alerts is a screen-reader flood. This is announced via
  // aria-describedby when focus reaches the control. Weighted to match the
  // uploader's error, which shares the page.
  return (
    <p id={id} className="mt-1.5 text-sm font-medium text-red-600 dark:text-red-400">
      {error}
    </p>
  );
}

function autoCompleteFor(name: string): string | undefined {
  switch (name) {
    case "first_name":
      return "given-name";
    case "last_name":
      return "family-name";
    case "email":
      return "email";
    case "phone":
      return "tel";
    default:
      return undefined;
  }
}

function SuccessPanel({ jobTitle, applicationId }: { jobTitle: string; applicationId: string }) {
  return (
    <div
      role="status"
      className="rounded-xl border border-emerald-300 bg-emerald-50 px-6 py-10 text-center dark:border-emerald-800 dark:bg-emerald-950"
    >
      <div
        aria-hidden="true"
        className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-600 text-2xl text-white"
      >
        ✓
      </div>
      <h2 className="mt-4 text-lg font-semibold text-emerald-900 dark:text-emerald-100">
        Application submitted
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-emerald-800 dark:text-emerald-200">
        Thanks for applying for <strong>{jobTitle}</strong>. We&apos;ve emailed you a confirmation
        and will be in touch about next steps.
      </p>
      <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-300">
        Reference: <code className="font-mono">{applicationId}</code>
      </p>
      <Link
        href="/"
        className="mt-6 inline-block rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
      >
        Back to open roles
      </Link>
    </div>
  );
}
