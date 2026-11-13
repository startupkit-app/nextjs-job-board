import { kit, KitApiError, KitNetworkError, type JobAlertForm } from "./kit";

/** Optional alerts must not take the job board down when discovery is unavailable. */
export async function fetchJobAlerts(): Promise<JobAlertForm | null> {
  try {
    return await kit.getJobAlerts({ next: { revalidate: 60, tags: ["jobs"] } });
  } catch (error) {
    if (error instanceof KitApiError || error instanceof KitNetworkError) return null;
    throw error;
  }
}

/** API-supplied privacy links must never become executable URLs. */
export function jobAlertPrivacyUrl(value: string | null): string | undefined {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}
