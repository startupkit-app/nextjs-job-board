import { kit, KitApiError, type JobDetail } from "./kit";
import { sanitizeRichHtml, sanitizeConsentHtml } from "./sanitize";

export const JOB_DETAIL_REVALIDATE = 300;

/** Cache tags for a single job: busting "jobs" refreshes everything. */
export function jobTags(token: string): string[] {
  return ["jobs", `job-${token}`];
}

/**
 * Fetches a job's detail (ISR-cached for 5 minutes, tag-revalidatable).
 * Returns null for unknown/unpublished tokens so callers can `notFound()`.
 */
export async function fetchJob(token: string): Promise<JobDetail | null> {
  try {
    const job = await kit.getJob(token, {
      next: { revalidate: JOB_DETAIL_REVALIDATE, tags: jobTags(token) },
    });
    return sanitizeJob(job);
  } catch (error) {
    if (error instanceof KitApiError && error.status === 404) return null;
    throw error;
  }
}

/**
 * Sanitizes the API's raw-HTML fields at the data boundary so no render site
 * (including client components) ever receives untrusted HTML. See ./sanitize.
 */
function sanitizeJob(job: JobDetail): JobDetail {
  return {
    ...job,
    description_html: sanitizeRichHtml(job.description_html),
    application_form: {
      ...job.application_form,
      consent_disclosure_html: sanitizeConsentHtml(job.application_form.consent_disclosure_html),
    },
  };
}
