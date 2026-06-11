import "server-only";

// ─── SDK ──────────────────────────────────────────────────────────────────────
// The single point where this template depends on the Kit SDK. Re-exported so the
// rest of the app imports types + the client from `@/lib/kit`.
export * from "@startupkit-app/jobs";
import { createClient } from "@startupkit-app/jobs";

/**
 * Server-side Kit client, authenticated with the SECRET key. The `server-only`
 * import above guarantees this module (and therefore the key) can never be
 * bundled into client components.
 */
export const kit = createClient({
  secretKey: process.env.STARTUPKIT_SECRET_KEY,
  baseUrl: process.env.STARTUPKIT_BASE_URL,
});

/** True once STARTUPKIT_SECRET_KEY is configured. Used for friendly setup hints. */
export const kitConfigured = Boolean(process.env.STARTUPKIT_SECRET_KEY);
