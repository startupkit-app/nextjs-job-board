"use server";

import { isIP } from "node:net";
import { headers } from "next/headers";
import { talentPoolFieldLabel } from "@/lib/format";
import { kit, KitApiError } from "@/lib/kit";
import {
  normalizeApiFieldErrors,
  RATE_LIMITED_MESSAGE,
  type FieldErrors,
} from "@/lib/kit-errors";
import { fetchTalentPool } from "@/lib/talent-pool";

// ─── Types shared with the client form (type-only — erased at runtime) ───────

export type SignupState =
  | { status: "idle" }
  | { status: "success"; entryId: string; email: string }
  | { status: "error"; message: string; fieldErrors?: FieldErrors };

/** Fields the resume uploader owns — never rendered as a plain text input. */
const RESUME_FIELDS = new Set(["resume", "resume_signed_id"]);

export async function joinTalentPool(
  _previous: SignupState,
  formData: FormData
): Promise<SignupState> {
  const form = await fetchTalentPool();
  if (!form) {
    return { status: "error", message: "This talent pool is no longer available." };
  }
  if (!form.accepting_signups) {
    return { status: "error", message: "This talent pool isn't accepting new signups right now." };
  }

  const value = (key: string): string => {
    const raw = formData.get(key);
    return typeof raw === "string" ? raw.trim() : "";
  };

  const email = value("email");
  const linkedinUrl = value("linkedin_url");
  const resumeSignedId = value("resume_signed_id");

  // Re-derive requirements from the API's own schema — never trust the client
  // to decide which fields may be blank.
  const submitted: Record<string, string> = {
    email,
    linkedin_url: linkedinUrl,
    resume_signed_id: resumeSignedId,
  };
  const fieldErrors: FieldErrors = {};

  for (const field of form.fields) {
    if (RESUME_FIELDS.has(field.name)) continue; // covered by form.resume below
    if (field.required && !submitted[field.name]) {
      fieldErrors[field.name] = `${talentPoolFieldLabel(field.name)} is required.`;
    }
  }
  if (!email) fieldErrors.email = "Email is required.";
  if (form.resume.required && !resumeSignedId) fieldErrors.resume = "Resume is required.";

  // The consent box is a record of what the person actually did: an untouched
  // checkbox submits nothing, and that absence must survive to Kit as `false`.
  const consent = formData.get("consent") === "true";
  if (form.consent.required && !consent) {
    fieldErrors.consent = "Please tick the box to give your consent.";
  }

  if (Object.keys(fieldErrors).length > 0) {
    return {
      status: "error",
      message: "Please fill in the highlighted fields below.",
      fieldErrors,
    };
  }

  const turnstileToken = value("turnstile_token");
  if (form.turnstile.required && !turnstileToken) {
    return {
      status: "error",
      message: "Please complete the spam-protection verification before submitting.",
    };
  }

  try {
    const result = await kit.joinTalentPool(
      {
        email,
        linkedin_url: linkedinUrl || undefined,
        resume_signed_id: resumeSignedId || undefined,
        consent,
        consent_ip_address: await consentIpAddress(),
      },
      { turnstileToken: turnstileToken || undefined }
    );

    return { status: "success", entryId: result.id, email };
  } catch (error) {
    if (error instanceof KitApiError) {
      if (error.status === 429) {
        return { status: "error", message: RATE_LIMITED_MESSAGE };
      }
      if (error.code === "already_in_talent_pool") {
        return {
          status: "error",
          message:
            "Good news — that email address is already in our talent pool, so there's nothing more to do. We'll be in touch when a role matches.",
        };
      }
      if (error.code === "consent_required") {
        return {
          status: "error",
          message: "We can only keep your details on file with your consent.",
          fieldErrors: { consent: "Please tick the box to give your consent." },
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
        message: error.message || "Your details couldn't be submitted.",
        fieldErrors: normalizeApiFieldErrors(error.fields),
      };
    }

    console.error("Talent-pool signup failed:", error);
    return {
      status: "error",
      message: "Something went wrong while submitting your details. Please try again.",
    };
  }
}

/**
 * A Server Action reaches Kit from the deployment's egress IP, so the consent
 * receipt would name this server rather than the person unless we forward the
 * browser's IP. Kit rejects an unparseable value, so omit it when in doubt.
 */
async function consentIpAddress(): Promise<string | undefined> {
  const headerList = await headers();
  const forwardedFor = headerList.get("x-forwarded-for")?.split(",")[0]?.trim();
  const candidate = forwardedFor || headerList.get("x-real-ip")?.trim() || "";
  return isIP(candidate) ? candidate : undefined;
}
