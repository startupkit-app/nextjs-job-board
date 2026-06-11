"use server";

import { fetchJob } from "@/lib/jobs";
import { kit, KitApiError, type DirectUploadMeta } from "@/lib/kit";

// ─── Types shared with the client form (type-only — erased at runtime) ───────

export type FieldErrors = Record<string, string>;

export type ApplyState =
  | { status: "idle" }
  | { status: "success"; applicationId: string; submittedAt: string }
  | { status: "error"; message: string; fieldErrors?: FieldErrors };

export type PresignResult =
  | { ok: true; signedId: string; url: string; headers: Record<string, string> }
  | { ok: false; error: string };

/** Core contact fields submitted at the top level of the application payload. */
const CORE_FIELDS = new Set(["email", "first_name", "last_name", "phone"]);

/**
 * Server Action bound to the job token from the client form:
 *   submitApplication.bind(null, token)
 *
 * Uses the SECRET key server-side, so the template works with a single
 * required env var and the key never reaches the browser.
 */
export async function submitApplication(
  token: string,
  _previous: ApplyState,
  formData: FormData
): Promise<ApplyState> {
  const job = await fetchJob(token);
  if (!job) {
    return { status: "error", message: "This job posting no longer exists." };
  }
  if (!job.accepting_applications) {
    return { status: "error", message: "This role is no longer accepting applications." };
  }

  const form = job.application_form;
  const value = (key: string): string => {
    const raw = formData.get(key);
    return typeof raw === "string" ? raw.trim() : "";
  };

  // Re-derive the payload from the API's own form schema — never trust the
  // client to decide which keys are fields vs. questions vs. files.
  const responses: Record<string, string> = {};
  const files: Record<string, string> = {};
  const fieldErrors: FieldErrors = {};

  for (const field of form.fields) {
    if (CORE_FIELDS.has(field.name)) continue;

    if (field.type === "file") {
      const signedId = value(`file:${field.name}`);
      if (signedId) files[field.name] = signedId;
      else if (field.required) fieldErrors[field.name] = `${field.label} is required.`;
    } else if (field.type === "checkbox") {
      if (formData.get(`field:${field.name}`)) responses[field.name] = "true";
      else if (field.required) fieldErrors[field.name] = `${field.label} must be accepted.`;
    } else {
      const fieldValue = value(`field:${field.name}`);
      if (fieldValue) responses[field.name] = fieldValue;
      else if (field.required) fieldErrors[field.name] = `${field.label} is required.`;
    }
  }

  for (const question of form.questions) {
    const answer = value(`question:${question.key}`);
    if (answer) responses[question.key] = answer;
    else if (question.required) fieldErrors[question.key] = "An answer is required.";
  }

  // Core contact fields. Email/first/last are always required by the API.
  const email = value("email");
  const firstName = value("first_name");
  const lastName = value("last_name");
  const phone = value("phone");

  if (!email) fieldErrors.email = "Email is required.";
  if (!firstName) fieldErrors.first_name = "First name is required.";
  if (!lastName) fieldErrors.last_name = "Last name is required.";
  const phoneField = form.fields.find((field) => field.name === "phone");
  if (phoneField?.required && !phone) fieldErrors.phone = "Phone number is required.";

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      message: "Please fill in the highlighted fields below.",
      fieldErrors,
    };
  }

  const resumeSignedId = value("resume_signed_id");
  const turnstileToken = value("turnstile_token");

  try {
    const result = await kit.submitApplication(
      token,
      {
        email,
        first_name: firstName,
        last_name: lastName,
        phone: phone || undefined,
        responses,
        resume_signed_id: resumeSignedId || undefined,
        files: Object.keys(files).length > 0 ? files : undefined,
      },
      turnstileToken || undefined
    );

    return { status: "success", applicationId: result.id, submittedAt: result.submitted_at };
  } catch (error) {
    if (error instanceof KitApiError) {
      if (error.code === "already_applied") {
        return {
          status: "error",
          message: "You've already applied for this role with that email address.",
        };
      }
      if (error.code === "turnstile_failed") {
        return {
          status: "error",
          message:
            "We couldn't verify that you're human. Please complete the verification challenge and try again.",
        };
      }
      return {
        status: "error",
        message: error.message || "Your application couldn't be submitted.",
        fieldErrors: normalizeApiFieldErrors(error.fields),
      };
    }

    console.error("Application submission failed:", error);
    return {
      status: "error",
      message: "Something went wrong while submitting your application. Please try again.",
    };
  }
}

/**
 * Presigns a direct upload via the Kit API (secret key, server-side). The
 * browser then PUTs the file straight to storage — bypassing Vercel's ~4.5 MB
 * request body limit — and submits the returned signed_id with the form.
 */
export async function createResumeUpload(meta: DirectUploadMeta): Promise<PresignResult> {
  if (!meta?.filename || !meta.byte_size || !meta.checksum || !meta.content_type) {
    return { ok: false, error: "Incomplete file metadata." };
  }

  try {
    const { signed_id, direct_upload } = await kit.createDirectUpload(meta);
    return { ok: true, signedId: signed_id, url: direct_upload.url, headers: direct_upload.headers };
  } catch (error) {
    if (error instanceof KitApiError) {
      return { ok: false, error: error.message };
    }
    console.error("Direct upload presign failed:", error);
    return { ok: false, error: "Couldn't prepare the upload. Please try again." };
  }
}

function normalizeApiFieldErrors(
  fields: Record<string, string | string[]> | undefined
): FieldErrors | undefined {
  if (!fields) return undefined;

  const normalized: FieldErrors = {};
  for (const [key, messages] of Object.entries(fields)) {
    // API keys may be nested ("responses.q_team_size") — index by the leaf so
    // the form can match them to inputs by field name / question key.
    const leaf = key.replace(/^(application|responses|files)\./, "");
    normalized[leaf] = Array.isArray(messages) ? messages.join(" ") : messages;
  }
  return normalized;
}
