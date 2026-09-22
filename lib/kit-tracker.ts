import { createTracker } from "@startupkit-app/jobs";

// Client-safe on purpose: no `server-only`, no secret key. Without a
// publishable key, or on the server, the tracker is a no-op.
export const tracker = createTracker({
  publishableKey: process.env.NEXT_PUBLIC_STARTUPKIT_PUBLISHABLE_KEY,
  // A blank `NEXT_PUBLIC_STARTUPKIT_BASE_URL=` line inlines "", which `new URL` rejects.
  baseUrl: process.env.NEXT_PUBLIC_STARTUPKIT_BASE_URL || undefined,
  onError:
    process.env.NODE_ENV === "development"
      ? (error) => console.warn("Kit analytics:", error)
      : undefined,
});
