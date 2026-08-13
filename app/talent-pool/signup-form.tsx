"use client";

import Link from "next/link";
import { useActionState, useEffect, useId, useRef } from "react";
import { FileUpload } from "@/components/file-upload";
import { Turnstile } from "@/components/turnstile";
import { talentPoolFieldLabel } from "@/lib/format";
import type { TalentPoolField, TalentPoolForm } from "@/lib/kit";
import type { FieldErrors } from "@/lib/kit-errors";
import { joinTalentPool, type SignupState } from "./actions";

const INITIAL_STATE: SignupState = { status: "idle" };
const RESUME_FIELD_NAMES = ["resume", "resume_signed_id"];

const INPUT_TYPES: Record<string, string> = {
  email: "email",
  linkedin_url: "url",
};

const AUTOCOMPLETE: Record<string, string> = {
  email: "email",
  linkedin_url: "url",
};

export function SignupForm({ form }: { form: TalentPoolForm }) {
  const [state, formAction, isPending] = useActionState(joinTalentPool, INITIAL_STATE);
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
    return <SuccessPanel email={state.email} entryId={state.entryId} />;
  }

  const errors: FieldErrors = state.status === "error" ? (state.fieldErrors ?? {}) : {};
  const fields = form.fields.filter((field) => !RESUME_FIELD_NAMES.includes(field.name));
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
        <legend className="text-base font-semibold">Your details</legend>
        {fields.map((field, index) => (
          <FieldControl
            key={field.name}
            field={field}
            error={errors[field.name]}
            autoFocus={index === 0}
          />
        ))}
      </fieldset>

      <FileUpload
        name="resume_signed_id"
        label="Resume / CV"
        required={form.resume.required}
        contentTypes={form.resume.content_types}
        maxByteSize={form.resume.max_byte_size}
        serverError={errors.resume ?? errors.resume_signed_id}
      />

      <ConsentCheckbox
        disclosureHtml={form.consent.disclosure_html}
        required={form.consent.required}
        error={errors.consent}
      />

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
          {isPending ? "Submitting…" : "Join the talent pool"}
        </button>
        <p className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
          Fields marked with <span className="text-red-600 dark:text-red-400">*</span> are required.
        </p>
      </div>
    </form>
  );
}

function FieldControl({
  field,
  error,
  autoFocus = false,
}: {
  field: TalentPoolField;
  error?: string;
  autoFocus?: boolean;
}) {
  const id = useId();
  const label = talentPoolFieldLabel(field.name);

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">
        {label}
        <RequiredMark required={field.required} />
      </label>
      <div className="mt-1.5">
        <input
          id={id}
          name={field.name}
          type={INPUT_TYPES[field.name] ?? "text"}
          required={field.required}
          autoFocus={autoFocus}
          autoComplete={AUTOCOMPLETE[field.name]}
          placeholder={field.name === "linkedin_url" ? "https://www.linkedin.com/in/…" : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={
            "block w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-2 focus:outline-indigo-500/40 dark:bg-zinc-900 dark:text-zinc-100 " +
            (error
              ? "border-red-400 dark:border-red-700"
              : "border-zinc-300 focus:border-indigo-500 dark:border-zinc-700")
          }
        />
      </div>
      <FieldError id={`${id}-error`} error={error} />
    </div>
  );
}

function ConsentCheckbox({
  disclosureHtml,
  required,
  error,
}: {
  disclosureHtml: string;
  required: boolean;
  error?: string;
}) {
  const id = useId();

  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
      <label htmlFor={id} className="flex cursor-pointer items-start gap-2.5 text-sm text-zinc-700 dark:text-zinc-300">
        <input
          id={id}
          name="consent"
          type="checkbox"
          value="true"
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="mt-0.5 size-4 shrink-0 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 dark:border-zinc-600"
        />
        <span className="job-description text-xs">
          {/* Server-sanitized at the data boundary (lib/sanitize.ts) before this prop is passed in. */}
          <span dangerouslySetInnerHTML={{ __html: disclosureHtml }} />
          <RequiredMark required={required} />
        </span>
      </label>
      <FieldError id={`${id}-error`} error={error} />
    </div>
  );
}

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

function SuccessPanel({ email, entryId }: { email: string; entryId: string }) {
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
        One last step — check your inbox
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-emerald-800 dark:text-emerald-200">
        We&apos;ve emailed a confirmation link to <strong>{email}</strong>. Click it to confirm your
        address — until you do, you are not in the talent pool yet.
      </p>
      <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-300">
        Reference: <code className="font-mono">{entryId}</code>
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
