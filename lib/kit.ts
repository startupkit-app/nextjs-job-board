import "server-only";

// ─── SDK ──────────────────────────────────────────────────────────────────────
// The single point where this template depends on the Kit SDK. Re-exported so the
// rest of the app imports types + the client from `@/lib/kit`.
export * from "@startupkit-app/jobs";
import { createClient } from "@startupkit-app/jobs";
import { previewKeyConfigured, previewMode } from "./preview";

const secretKey = !previewMode || previewKeyConfigured ? process.env.STARTUPKIT_SECRET_KEY : undefined;

/**
 * Server-side Kit client, authenticated with the SECRET key. The `server-only`
 * import above guarantees this module (and therefore the key) can never be
 * bundled into client components.
 */
export const kit = createClient({
  secretKey,
  baseUrl: process.env.STARTUPKIT_BASE_URL,
});

/** Demo deployments require a preview key even if a live key is present. */
export const kitConfigured = Boolean(secretKey);
