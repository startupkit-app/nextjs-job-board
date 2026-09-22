# Kit job analytics — integration brief

Paste this file into your coding agent to add Kit's job analytics to a site that already talks
to Kit's public hiring API, including a site forked from an older version of this template.

Kit's **Hiring → Analytics** dashboard (views, unique visitors, traffic sources, UTM campaigns,
countries, devices, landing pages, view → apply funnel) is fed by page events. Kit's hosted
career portal sends them itself; a headless site has to, or the dashboard stays empty.
`@startupkit-app/jobs` >= 0.5.0 ships `createTracker`, which posts five typed events to
`POST /api/public/v1/events` straight from the visitor's browser; Kit records them as the same
events the hosted portal writes, so every chart fills in unchanged.

Four things to get right:

1. **Publishable (`pk_…`) key, browser only.** Visitor identity and geo are read from the
   browser's own request, so a server-side relay would count every visitor as your server.
   `createTracker` throws on an `sk_…` key. If the key has an origin allowlist (Kit → Hiring →
   Career Portal → Public API Keys), the site's origin must be on it or every batch is a 403
   `origin_not_allowed`.
2. **Track in the browser, not on the server.** Pages are ISR/statically cached, so a
   server-side call would fire once per regeneration, not once per visitor.
3. **Count each view once.** Guard `useEffect` with a ref: React StrictMode double-invokes
   effects in development, and an autofocused first field fires the form's `onFocus` during mount.
4. **Success only.** `applicationSubmitted` / `talentPoolJoined` fire when the submission
   succeeded, never on a rejection.

## Steps

1. `npm i @startupkit-app/jobs@^0.5.0` (a caret on `0.x` does not cross minors, so `^0.4.0`
   will not pick it up by itself).
2. Add the env var, and document it in `.env.example` / your README:

   ```bash
   # Publishable key (pk_…). Unset = analytics off. No-op without it.
   NEXT_PUBLIC_STARTUPKIT_PUBLISHABLE_KEY=
   # Only alongside a custom STARTUPKIT_BASE_URL.
   NEXT_PUBLIC_STARTUPKIT_BASE_URL=
   ```

3. Create `lib/kit-tracker.ts`. Client-safe: no `server-only` import, no secret key. Do not
   import `lib/kit.ts` (server-only) from client code.

   ```ts
   import { createTracker } from "@startupkit-app/jobs";

   export const tracker = createTracker({
     publishableKey: process.env.NEXT_PUBLIC_STARTUPKIT_PUBLISHABLE_KEY,
     baseUrl: process.env.NEXT_PUBLIC_STARTUPKIT_BASE_URL,
     onError:
       process.env.NODE_ENV === "development"
         ? (error) => console.warn("Kit analytics:", error)
         : undefined,
   });
   ```

4. Create `components/kit-analytics.tsx`, two render-nothing client components:

   ```tsx
   "use client";

   import { useEffect, useRef } from "react";
   import { tracker } from "@/lib/kit-tracker";

   export function TrackJobBoardView() {
     const sent = useRef(false);
     useEffect(() => {
       if (sent.current) return;
       sent.current = true;
       tracker.jobBoardViewed();
     }, []);
     return null;
   }

   export function TrackJobView({ job }: { job: string }) {
     const sent = useRef<string | null>(null);
     useEffect(() => {
       if (sent.current === job) return;
       sent.current = job;
       tracker.jobViewed(job);
     }, [job]);
     return null;
   }
   ```

5. Render them from the server pages, after any "not configured" early return:
   `<TrackJobBoardView />` inside the job list page (`app/page.tsx`), and
   `<TrackJobView job={job.id} />` inside the job detail page (`app/jobs/[token]/page.tsx`).
   `job.id` is the public token from `listJobs` / `getJob`, the same value as the `[token]`
   route param.

6. In the apply form client component (`app/jobs/[token]/apply/apply-form.tsx`), before the
   success early return:

   ```tsx
   import { tracker } from "@/lib/kit-tracker";

   // The first field autofocuses during mount, before effects run; only focus
   // after that is the applicant's own. The tracker dedupes per job.
   const mounted = useRef(false);
   useEffect(() => {
     mounted.current = true;
   }, []);
   const handleFocus = useCallback(() => {
     if (mounted.current) tracker.applicationStarted(token);
   }, [token]);

   useEffect(() => {
     if (state.status === "success") tracker.applicationSubmitted(token);
   }, [state.status, token]);
   ```

   and `<form onFocus={handleFocus} …>`. `token` is the job's public token prop; `state` is
   the `useActionState` result. If the form has no autofocus, drop the `mounted` guard.

7. In the talent-pool form (`app/talent-pool/signup-form.tsx`), before the success early return:

   ```tsx
   useEffect(() => {
     if (state.status === "success") tracker.talentPoolJoined();
   }, [state.status]);
   ```

8. Verify: `npm run lint && npm run typecheck && npm run build`, then run the site with the key
   set, open a job page, and confirm in DevTools → Network a `POST /api/public/v1/events`
   returning `202`. Kit → Hiring → Analytics shows the view shortly after. `401`/`403` means the
   key or its allowed origins are wrong in Kit; `404` means the Kit server is not yet on a
   release with the endpoint. The page works either way.

Reference implementation: `lib/kit-tracker.ts`, `components/kit-analytics.tsx` and the call
sites above in this repo. Tracker API: the "Job analytics (browser tracker)" section of the
[`@startupkit-app/jobs` README](https://www.npmjs.com/package/@startupkit-app/jobs).
Full API docs: <https://startupkit.app/docs/public-jobs-api>
