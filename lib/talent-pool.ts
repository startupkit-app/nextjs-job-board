import { kit, KitApiError, type TalentPoolForm } from "./kit";
import { sanitizeConsentHtml } from "./sanitize";

export const TALENT_POOL_REVALIDATE = 300;

/** Cache tag for the talent-pool schema, revalidatable on its own. */
export const TALENT_POOL_TAG = "talent-pool";

/**
 * Fetches the talent-pool form schema (ISR-cached for 5 minutes,
 * tag-revalidatable). Returns null when the account exposes no talent pool so
 * callers can `notFound()`.
 */
export async function fetchTalentPool(): Promise<TalentPoolForm | null> {
  try {
    const form = await kit.getTalentPool({
      next: { revalidate: TALENT_POOL_REVALIDATE, tags: [TALENT_POOL_TAG] },
    });
    return sanitizeTalentPool(form);
  } catch (error) {
    if (error instanceof KitApiError && error.status === 404) return null;
    throw error;
  }
}

/**
 * Sanitizes the consent disclosure at the data boundary so no render site
 * (including client components) ever receives untrusted HTML. See ./sanitize.
 */
function sanitizeTalentPool(form: TalentPoolForm): TalentPoolForm {
  return {
    ...form,
    consent: {
      ...form.consent,
      disclosure_html: sanitizeConsentHtml(form.consent.disclosure_html),
    },
  };
}
