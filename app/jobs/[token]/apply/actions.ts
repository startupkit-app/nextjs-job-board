"use server";

import { cookies } from "next/headers";
import { signInsightToken, verifyInsightToken } from "@/lib/insight-cookie";
import { fetchJob } from "@/lib/jobs";
import {
  kit,
  KitApiError,
  KitInsightError,
  type ApplicationInsights,
  type InsightAnswerValue,
} from "@/lib/kit";
import {
  INSIGHT_SAVE_FAILED_MESSAGE,
  normalizeApiFieldErrors,
  RATE_LIMITED_MESSAGE,
  type FieldErrors,
} from "@/lib/kit-errors";

// ─── Types shared with the client form (type-only — erased at runtime) ───────

export type ApplyState =
  | { status: "idle" }
  | { status: "success"; applicationId: string; submittedAt: string; insights?: DeckInsights }
  | { status: "error"; message: string; fieldErrors?: FieldErrors };

export type DeckInsights = Omit<ApplicationInsights, "token">;

export type InsightAnswerState =
  | { status: "saved"; value: InsightAnswerValue; remaining: number }
  | { status: "invalid"; message: string }
  | { status: "not_askable" }
  | { status: "closed" }
  | { status: "failed"; message: string };

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
    if (field.name === "resume") continue; // handled via resume_signed_id below

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

  // Resume travels as a signed_id from the dedicated uploader, not as a generic
  // file field — enforce its required flag here.
  const resumeSignedId = value("resume_signed_id");
  if (form.resume.required && !resumeSignedId) fieldErrors.resume = "Resume is required.";

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      message: "Please fill in the highlighted fields below.",
      fieldErrors,
    };
  }

  // When the employer's key has Turnstile configured the form must carry a token;
  // the API verifies the forwarded token even on the secret-key server path.
  const turnstileToken = value("turnstile_token");
  if (form.turnstile.required && !turnstileToken) {
    return {
      status: "error",
      message: "Please complete the spam-protection verification before submitting.",
    };
  }

  try {
    const result = await kit.apply(
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
      { turnstileToken: turnstileToken || undefined }
    );

    const success = { status: "success", applicationId: result.id, submittedAt: result.submitted_at } as const;
    if (!result.insights?.questions.length) return success;

    // Page JavaScript never sees the answer token: not in client state, action arguments or URLs.
    const { token: insightToken, ...insights } = result.insights;
    const signed = signInsightToken(result.id, insightToken);
    if (!signed) return success;
    (await cookies()).set(insightCookie(result.id), signed, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
    });
    return { ...success, insights };
  } catch (error) {
    if (error instanceof KitApiError) {
      if (error.status === 429) {
        return { status: "error", message: RATE_LIMITED_MESSAGE };
      }
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

const INVALID_ANSWER_MESSAGE = "That answer couldn't be saved. Check it and try again.";

// Per application, so a second apply to the same job in this browser can't redirect the first deck.
function insightCookie(applicationId: string): string {
  return `kit_insights_${encodeURIComponent(applicationId)}`;
}

export async function answerInsight(
  applicationId: string,
  id: string,
  value: InsightAnswerValue
): Promise<InsightAnswerState> {
  if (typeof applicationId !== "string" || typeof id !== "string" || !id || !isAnswerValue(value)) {
    return { status: "invalid", message: INVALID_ANSWER_MESSAGE };
  }

  const store = await cookies();
  const token = verifyInsightToken(applicationId, store.get(insightCookie(applicationId))?.value);
  if (!token) return { status: "closed" };

  try {
    const { answer, remaining } = await kit.answerInsight({ token, id, value });
    return { status: "saved", value: answer.value, remaining };
  } catch (error) {
    if (error instanceof KitInsightError) {
      if (error.code === "not_askable") return { status: "not_askable" };
      if (error.code === "insights_closed") {
        store.delete(insightCookie(applicationId));
        return { status: "closed" };
      }
      return { status: "invalid", message: error.message || INVALID_ANSWER_MESSAGE };
    }
    if (error instanceof KitApiError && error.status === 429) {
      return { status: "failed", message: RATE_LIMITED_MESSAGE };
    }
    console.error("Insight answer failed:", error);
    return { status: "failed", message: INSIGHT_SAVE_FAILED_MESSAGE };
  }
}

function isAnswerValue(value: unknown): value is InsightAnswerValue {
  if (Array.isArray(value)) return value.length <= 100 && value.every((tag) => typeof tag === "string");
  return (
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  );
}
