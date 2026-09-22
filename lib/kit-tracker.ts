import * as Kit from "@startupkit-app/jobs";

// TODO(0.5.0): drop this shim for `import { createTracker }` and bump to ^0.5.0.
// 0.5.0 isn't on npm yet, so detect it and no-op against 0.4.x.
interface KitTracker {
  jobBoardViewed(): void;
  jobViewed(job: string): void;
  applicationStarted(job: string): void;
  applicationSubmitted(job: string): void;
  talentPoolJoined(): void;
}

type CreateTracker = (options: {
  publishableKey: string | undefined;
  baseUrl?: string;
  onError?: (error: unknown) => void;
}) => KitTracker;

const noop = () => {};
const createTracker = (Kit as { createTracker?: CreateTracker }).createTracker;

// Client-safe on purpose: no `server-only`, no secret key. Without a
// publishable key, or on the server, the tracker is a no-op.
export const tracker: KitTracker = createTracker
  ? createTracker({
      publishableKey: process.env.NEXT_PUBLIC_STARTUPKIT_PUBLISHABLE_KEY,
      baseUrl: process.env.NEXT_PUBLIC_STARTUPKIT_BASE_URL,
      onError:
        process.env.NODE_ENV === "development"
          ? (error) => console.warn("Kit analytics:", error)
          : undefined,
    })
  : {
      jobBoardViewed: noop,
      jobViewed: noop,
      applicationStarted: noop,
      applicationSubmitted: noop,
      talentPoolJoined: noop,
    };
