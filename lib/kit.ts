import "server-only";

// ─── SDK import ───────────────────────────────────────────────────────────────
// `@startupkit-app/jobs` is declared in package.json but not published to npm yet,
// so the template ships with a local, API-compatible shim. Once the package is
// available, swapping it in is a one-line change — replace the two lines below
// with:
//
//   export * from "@startupkit-app/jobs";
//   import { createClient } from "@startupkit-app/jobs";
//
export * from "./kit-sdk-shim";
import { createClient } from "./kit-sdk-shim";

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
