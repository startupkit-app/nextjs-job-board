/** Shared submission-failure copy and error shaping for Kit API calls. */

/**
 * The Kit API rate-limits submissions and upload presigns per client IP. This
 * template submits through Server Actions, so every visitor reaches the API
 * from the same server egress IP and they all share one bucket. That makes 429
 * a realistic response on a busy careers page rather than an edge case, so it
 * gets a message that tells the visitor what to do instead of reading as a
 * generic failure.
 */
export const RATE_LIMITED_MESSAGE =
  "We're receiving a lot of submissions right now. Please wait a few minutes and try again — your answers will still be here.";

/** Field name (or question key) → the message to render beneath that control. */
export type FieldErrors = Record<string, string>;

export function normalizeApiFieldErrors(
  fields: Record<string, string | string[]> | undefined
): FieldErrors | undefined {
  if (!fields) return undefined;

  const normalized: FieldErrors = {};
  for (const [key, messages] of Object.entries(fields)) {
    // API keys may be nested ("responses.q_team_size", "talent_pool_entry.email")
    // — index by the leaf so a form can match them to inputs by field name.
    const leaf = key.replace(/^(application|responses|files|talent_pool_entry)\./, "");
    normalized[leaf] = Array.isArray(messages) ? messages.join(" ") : messages;
  }
  return normalized;
}
