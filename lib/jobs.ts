import { kit, KitApiError, type JobDetail } from "./kit";

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
    return await kit.getJob(token, {
      next: { revalidate: JOB_DETAIL_REVALIDATE, tags: jobTags(token) },
    });
  } catch (error) {
    if (error instanceof KitApiError && error.status === 404) return null;
    throw error;
  }
}
