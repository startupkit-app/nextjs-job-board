// Compatibility shims for fields the Kit API already returns but the pinned SDK
// version does not yet declare in its types.
//
// This module deliberately imports ONLY types from `@/lib/kit`. That import is
// erased at compile time, so this file stays safe to use from client components
// even though `@/lib/kit` itself is `server-only`.

import type { ApplicationForm } from "@/lib/kit";

/**
 * Whether the posting's current hiring stage mandates a CV.
 *
 * The API publishes this as `application_form.resume.required`, but the
 * `ResumeRequirements` type in @startupkit-app/jobs@0.1.x predates the field.
 * The SDK casts the JSON response rather than validating it, so the value is
 * already present at runtime — only the type is behind.
 *
 * Previously this was inferred from a required form field literally named
 * "resume". The API no longer emits that field and ignores it if sent, so that
 * inference silently reported `false` for every posting.
 *
 * Once the SDK declares the field, delete this helper and read
 * `form.resume.required` directly.
 */
export function isResumeRequired(form: ApplicationForm): boolean {
  return (form.resume as { required?: boolean }).required ?? false;
}
