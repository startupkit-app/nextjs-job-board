"use client";

import Link from "next/link";
import { useActionState, useEffect, useId, useMemo, useRef, useState } from "react";
import { Turnstile } from "@/components/turnstile";
import type { ApplicationForm, FormField, Question } from "@/lib/kit-sdk-shim";
import { submitApplication, type ApplyState, type FieldErrors } from "./actions";
import { FileUpload } from "./resume-upload";

const INITIAL_STATE: ApplyState = { status: "idle" };
const CORE_FIELD_NAMES = ["first_name", "last_name", "email", "phone"] as const;

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
  const boundAction = useMemo(() => submitApplication.bind(null, token), [token]);
  const [state, formAction, isPending] = useActionState(boundAction, INITIAL_STATE);
  const formRef = useRef<HTMLFormElement>(null);

  // A11y: when submission fails, surface the alert and move focus to the
  // first invalid control.
  useEffect(() => {
    if (state.status !== "error") return;
    const formElement = formRef.current;
    if (!formElement) return;
    formElement.querySelector('[role="alert"]')?.scrollIntoView({ behavior: "smooth", block: "center" });
    formElement.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [state]);

  if (state.status === "success") {
    return <SuccessPanel jobTitle={jobTitle} applicationId={state.applicationId} />;
  }

  const errors: FieldErrors = state.status === "error" ? (state.fieldErrors ?? {}) : {};

  const coreFields = CORE_FIELD_NAMES.map(
    (name) => form.fields.find((field) => field.name === name) ?? DEFAULT_CORE_FIELDS[name]
  );
  const extraFields = form.fields.filter(
    (field) => !CORE_FIELD_NAMES.includes(field.name as (typeof CORE_FIELD_NAMES)[number])
  );

  const turnstileSitekey = form.turnstile.sitekey || process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || null;

  return (
    <form ref={formRef} action={formAction} noValidate className="space-y-7">
      {state.status === "error" && (
        <div
          role="alert"
          className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
        >
          {state.message}
        </div>
      )}

      <fieldset className="space-y-5">
        <legend className="text-base font-semibold">Contact details</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          {coreFields.map((field, index) => (
            <FieldControl
              key={field.name}
              field={field}
              inputName={field.name}
              error={errors[field.name]}
              autoFocus={index === 0}
            />
          ))}
        </div>
      </fieldset>

      <FileUpload
        name="resume_signed_id"
        label="Resume / CV"
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
            <QuestionControl key={question.key} question={question} error={errors[question.key]} />
          ))}
        </fieldset>
      )}

      {form.consent_disclosure_html && (
        <div
          className="job-description rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-xs dark:border-zinc-800 dark:bg-zinc-900"
          dangerouslySetInnerHTML={{ __html: form.consent_disclosure_html }}
        />
      )}

      {turnstileSitekey ? (
        <Turnstile sitekey={turnstileSitekey} />
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
        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-lg bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-wait disabled:opacity-60 sm:w-auto"
        >
          {isPending ? "Submitting…" : "Submit application"}
        </button>
        <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
          Fields marked with <span className="text-red-600 dark:text-red-400">*</span> are required.
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
  error,
  autoFocus = false,
}: {
  field: FormField;
  inputName: string;
  error?: string;
  autoFocus?: boolean;
}) {
  const id = useId();
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
          className={inputClass}
        />
      );
      break;

    case "select":
      control = (
        <select {...shared} defaultValue="" className={inputClass}>
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

function QuestionControl({ question, error }: { question: Question; error?: string }) {
  const id = useId();

  if (question.type === "multiple_choice") {
    return (
      <fieldset aria-describedby={error ? `${id}-error` : undefined} aria-invalid={error ? true : undefined}>
        <legend className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {question.prompt}
          <RequiredMark required={question.required} />
        </legend>
        <div className="mt-2.5 space-y-2">
          {(question.options ?? []).map((option) => (
            <label
              key={option}
              className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-zinc-200 px-3.5 py-2.5 text-sm text-zinc-700 has-checked:border-indigo-400 has-checked:bg-indigo-50 dark:border-zinc-700 dark:text-zinc-300 dark:has-checked:border-indigo-600 dark:has-checked:bg-indigo-950"
            >
              <input
                type="radio"
                name={`question:${question.key}`}
                value={option}
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
      id={id}
      name={`question:${question.key}`}
      label={question.prompt}
      required={question.required}
      maxLength={question.max_length}
      rows={question.type === "scenario" ? 7 : 4}
      error={error}
    />
  );
}

function CountedTextarea({
  id,
  name,
  label,
  required,
  maxLength,
  rows,
  error,
}: {
  id: string;
  name: string;
  label: string;
  required: boolean;
  maxLength: number;
  rows: number;
  error?: string;
}) {
  const [count, setCount] = useState(0);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {label}
          <RequiredMark required={required} />
        </label>
        {maxLength > 0 && (
          <span
            aria-hidden="true"
            className={`shrink-0 text-xs tabular-nums ${
              count >= maxLength ? "text-red-600 dark:text-red-400" : "text-zinc-400 dark:text-zinc-500"
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
        onChange={(event) => setCount(event.target.value.length)}
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
  return (
    <span aria-hidden="true" className="ml-0.5 text-red-600 dark:text-red-400">
      *
    </span>
  );
}

function FieldError({ id, error }: { id: string; error?: string }) {
  if (!error) return null;
  return (
    <p id={id} className="mt-1.5 text-sm text-red-600 dark:text-red-400">
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
