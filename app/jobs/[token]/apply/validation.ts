import type { ApplicationForm, FormField } from "@/lib/kit";
import type { FieldErrors } from "@/lib/kit-errors";

/**
 * Client-side mirror of the checks in `actions.ts`, derived from the same
 * `ApplicationForm` the API hands us. Nothing here is hardcoded per-job: the
 * required flags and lengths come from the schema, so the browser and the
 * server can never drift apart. The server stays authoritative — this exists
 * only to spare the applicant a round-trip.
 */
export type Rule = {
  /** Name of the form control, e.g. "email", "field:portfolio". */
  inputName: string;
  /** Key used in `FieldErrors`, matching what the server returns. */
  errorKey: string;
  label: string;
  required: boolean;
  kind: "text" | "email" | "url" | "checkbox" | "choice" | "file";
  /**
   * What to say when this control is required and empty. Decided here, where
   * we still know whether the label is a field's noun or a question's whole
   * sentence; recovering that later would mean re-reading the `question:`
   * prefix off the input name to answer a question we already knew.
   */
  requiredMessage: string;
};

/** Contact fields the API takes at the top level of the payload. */
export const CORE_FIELD_NAMES = ["first_name", "last_name", "email", "phone"] as const;

/** The resume travels via its own uploader, so it is never a generic field. */
export const RESERVED_FIELD_NAMES: readonly string[] = [...CORE_FIELD_NAMES, "resume"];

export const RESUME_INPUT_NAME = "resume_signed_id";
export const RESUME_LABEL = "Resume / CV";

export function buildRules(form: ApplicationForm, coreFields: FormField[]): Rule[] {
  const rules: Rule[] = [];

  for (const field of coreFields) {
    rules.push(fieldRule(field, field.name));
  }

  rules.push({
    inputName: RESUME_INPUT_NAME,
    errorKey: "resume",
    label: RESUME_LABEL,
    required: form.resume.required,
    kind: "file",
    requiredMessage: `Add your ${softLabel(RESUME_LABEL)}.`,
  });

  for (const field of form.fields) {
    if (RESERVED_FIELD_NAMES.includes(field.name)) continue;
    const prefix = field.type === "file" ? "file" : "field";
    rules.push(fieldRule(field, `${prefix}:${field.name}`));
  }

  for (const question of form.questions) {
    const choice = question.type === "multiple_choice";
    rules.push({
      inputName: `question:${question.key}`,
      errorKey: question.key,
      label: question.prompt,
      required: question.required,
      kind: choice ? "choice" : "text",
      requiredMessage: choice ? "Pick one option." : "This one needs an answer.",
    });
  }

  return rules;
}

function fieldRule(field: FormField, inputName: string): Rule {
  const kind = kindForField(field);
  return {
    inputName,
    errorKey: field.name,
    label: field.label,
    required: field.required,
    kind,
    requiredMessage:
      kind === "checkbox" ? "Tick this to continue." : `Add your ${softLabel(field.label)}.`,
  };
}

function kindForField(field: FormField): Rule["kind"] {
  switch (field.type) {
    case "file":
      return "file";
    case "checkbox":
      return "checkbox";
    case "email":
      return "email";
    case "url":
      return "url";
    default:
      return "text";
  }
}

export function validateValue(rule: Rule, raw: string): string | undefined {
  const value = raw.trim();

  if (rule.kind === "checkbox") {
    return rule.required && value !== "true" ? rule.requiredMessage : undefined;
  }
  if (!value) {
    return rule.required ? rule.requiredMessage : undefined;
  }

  // Shape checks run only on non-empty input, and only where a mistake is
  // unambiguous. Deliverability, phone shape and URL reachability belong to
  // the server (and to reality), not to a regex in the browser.
  if (rule.kind === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return "That email address is missing an @ or a domain.";
  }
  if (rule.kind === "url" && !/^https?:\/\/\S+$/i.test(value)) {
    return "Add a full link, starting with https://";
  }

  return undefined;
}

/**
 * Validates and snapshots in one pass. The snapshot is what lets a corrected
 * field clear its own error later, so it has to be taken from the same
 * `FormData` the errors were derived from.
 */
export function validateForm(
  formData: FormData,
  rules: Rule[]
): { errors: FieldErrors; submitted: Record<string, string> } {
  const errors: FieldErrors = {};
  const submitted: Record<string, string> = {};

  for (const rule of rules) {
    const raw = formData.get(rule.inputName);
    const value = typeof raw === "string" ? raw : "";
    submitted[rule.inputName] = value;
    const message = validateValue(rule, value);
    if (message) errors[rule.errorKey] = message;
  }

  return { errors, submitted };
}

/**
 * Lowercases the first letter only when the label is plain sentence case, so
 * "First name" becomes "first name" while "LinkedIn profile" and "GitHub" keep
 * their capitals.
 */
function softLabel(label: string): string {
  const sentenceCase = label.charAt(0) + label.slice(1).toLowerCase();
  return label === sentenceCase ? label.charAt(0).toLowerCase() + label.slice(1) : label;
}

/** Stable DOM id for a control, so the error summary can link to it. */
export function controlId(inputName: string): string {
  return `apply-${inputName.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

export function summaryHeading(count: number): string {
  return count === 1
    ? "One thing needs fixing before you can submit."
    : `${count} things need fixing before you can submit.`;
}
