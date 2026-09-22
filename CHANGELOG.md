# Changelog

Notable changes to this template, in the format of [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
The template is a fork-and-deploy starter rather than a published package: it has never been
tagged or released to a registry, so entries are grouped by date instead of version number.

## [Unreleased]

### Added

- Kit job analytics, reported from the visitor's browser by the `@startupkit-app/jobs` 0.5
  tracker: `job_board.viewed` and `job.viewed` page views, `application.started` on the first
  keystroke, or focus other than the first field's autofocus, in the apply form,
  `application.submitted` and `talent_pool.joined` on success. Kit → Hiring → Analytics (views,
  unique visitors, traffic sources, UTM campaigns, countries, devices, landing pages,
  view → apply funnel) fills in for this site as it does for the hosted portal
- `NEXT_PUBLIC_STARTUPKIT_PUBLISHABLE_KEY` (`pk_…`) turns analytics on; unset, the tracker is a
  no-op. `NEXT_PUBLIC_STARTUPKIT_BASE_URL` is the browser-side counterpart of
  `STARTUPKIT_BASE_URL` for custom Kit domains
- `lib/kit-tracker.ts` (one client-safe tracker instance) and `components/kit-analytics.tsx`
  (`<TrackJobBoardView />`, `<TrackJobView />`)
- `ANALYTICS.md`: integration brief for adding the same analytics to another codebase
- Hiring-process timeline support for optional paid-stage compensation, presented as explicit
  eligibility for a one-time payment with responsive, accessible light/dark styling
- Talent-pool signup page at `/talent-pool`, rendered from `GET /api/public/v1/talent_pool` and submitted to `POST /api/public/v1/talent_pool/entries`
- Consent checkbox that starts unchecked, labelled with the API's disclosure HTML (sanitized server-side at the fetch boundary)
- The visitor's IP is forwarded as `consent_ip_address` so the consent receipt records the person, not this server's egress address
- `lib/talent-pool.ts`: cached form fetcher mirroring `lib/jobs.ts` (ISR 300s, `talent-pool` cache tag)
- Links to the talent pool from the job list heading and from the empty state
- `TALENT_POOL.md`: integration brief for adapting the flow into another codebase

### Changed

- Resume uploader moved to `components/file-upload.tsx` and its presign action to `lib/upload-actions.ts`, shared by both forms
- Shared submission-failure copy and API field-error shaping extracted to `lib/kit-errors.ts`; the rate-limit message now says "submissions" rather than "applications"
- `@startupkit-app/jobs` dependency raised to `^0.5.0` for `createTracker` (previously `^0.4.0`
  for the talent-pool methods and typed stage-level compensation contract)
- Minimum Node.js version raised to 20.19.0 to match the SDK's supported runtime floor

### Fixed

- `application.started` fired on every direct load of an apply page, so the funnel's "started"
  equalled apply-page views. The `mounted` ref only skipped React's autofocus on client-side
  navigation; on a hard load the form streams in behind `loading.tsx` and the browser focuses
  its server-rendered `autofocus` field after hydration, when the guard is already off. Focus on the autofocused field no longer counts;
  typing into it still does
- A blank `NEXT_PUBLIC_STARTUPKIT_BASE_URL=` line (as `.env.example` shipped it) crashed every
  page importing the tracker: Next.js inlines `""`, and `createTracker` in SDK 0.5.0 throws on
  `new URL("…", "")`. `lib/kit-tracker.ts` now passes `|| undefined`, and `.env.example` ships
  the variable commented out

### Upgrade guide: job analytics for existing forks

Optional, and a no-op until `NEXT_PUBLIC_STARTUPKIT_PUBLISHABLE_KEY` is set. Requires the Kit
server release that ships `POST /api/public/v1/events`; before it, the tracker gets a 404,
reports it to `onError` and the page is unaffected.

1. `npm i @startupkit-app/jobs@^0.5.0`. A caret on `0.x` does not cross minors, so `^0.4.0`
   stays on 0.4 by itself.
2. In Kit → Hiring → Career Portal → Public API Keys, take the **publishable** key (`pk_…`), or
   create one. If it has an origin allowlist, add the site's origin. Set it as
   `NEXT_PUBLIC_STARTUPKIT_PUBLISHABLE_KEY` (locally and in Vercel). Only set
   `NEXT_PUBLIC_STARTUPKIT_BASE_URL` if you also set `STARTUPKIT_BASE_URL`.
3. Copy from this repo, or write from [ANALYTICS.md](ANALYTICS.md):
   - `lib/kit-tracker.ts` (new): the tracker instance. Client-safe, never imports `lib/kit.ts`.
   - `components/kit-analytics.tsx` (new): `<TrackJobBoardView />` and `<TrackJobView />`,
     `useEffect` guarded by a ref so StrictMode does not double-count.
   - `app/page.tsx`: render `<TrackJobBoardView />` in the job list.
   - `app/jobs/[token]/page.tsx`: render `<TrackJobView job={job.id} />` in the job detail.
   - `app/jobs/[token]/apply/apply-form.tsx`: `<form onFocus onInput>` →
     `tracker.applicationStarted(token)` (skipping focus on the autofocused field), and
     `tracker.applicationSubmitted(token)` in an effect on `state.status === "success"`.
   - `app/talent-pool/signup-form.tsx`: `tracker.talentPoolJoined()` in an effect on
     `state.status === "success"`.
   - `.env.example` and README: the two env vars.
4. Verify: `npm run lint && npm run typecheck && npm run build`; run the site with the key, open
   a job page, and DevTools → Network shows `POST /api/public/v1/events` → `202`. Kit → Hiring →
   Analytics shows the view shortly after. `401`/`403`: key or allowed origins; `404`: Kit
   server not on the release yet.

#### Prompt for your AI coding agent

````text
This site is a fork of github.com/startupkit-app/nextjs-job-board. Add Kit's browser-side job
analytics as described in ANALYTICS.md of that repo (fetch the raw file from its main branch
and follow it exactly).

1. Run `npm i @startupkit-app/jobs@^0.5.0` and confirm package.json has a range that includes
   0.5.0.
2. Add `NEXT_PUBLIC_STARTUPKIT_PUBLISHABLE_KEY` (and, only if this fork sets a custom
   STARTUPKIT_BASE_URL, `NEXT_PUBLIC_STARTUPKIT_BASE_URL`) to .env.example and the README's
   environment-variable table. Never put a secret key (sk_…) in a NEXT_PUBLIC_ variable:
   createTracker throws on one.
3. Create lib/kit-tracker.ts exporting one `tracker = createTracker({...})` as in ANALYTICS.md.
   It must not import lib/kit.ts (server-only) and must not be wrapped in guards: without a key
   or on the server it is already a no-op.
4. Create components/kit-analytics.tsx with `<TrackJobBoardView />` and `<TrackJobView job />`,
   each a "use client" component whose useEffect is guarded by a ref (StrictMode double-invoke).
5. Wire the calls, using the job's public token (`job.id` from listJobs/getJob, the `[token]`
   route param):
   - `<TrackJobBoardView />` in the jobs list page, after any "not configured" early return.
   - `<TrackJobView job={job.id} />` in the job detail page.
   - Apply form: `tracker.applicationStarted(token)` from the form's onFocus and onInput,
     ignoring focus events whose target is the autofocused field; `tracker.applicationSubmitted(token)`
     once, in an effect when the action state becomes success. Never on failure.
   - Talent-pool form: `tracker.talentPoolJoined()` once, in an effect when the action state
     becomes success. Never on failure.
6. Do not change any existing API calls or server actions.
7. Verify `npm run lint && npm run typecheck && npm run build` pass, then run the site with the
   key set, open a job page and confirm in DevTools → Network a `POST /api/public/v1/events`
   returning 202. 401/403 means the key or its allowed origins are wrong in Kit (Hiring →
   Career Portal → Public API Keys); 404 means the Kit server is not on a release with the
   endpoint yet. The page must work either way.
````

### Upgrade guide: analytics fixes for forks that already added analytics

Skip this if you have not added analytics yet: the guide above already includes both fixes.

1. `app/jobs/[token]/apply/apply-form.tsx`: replace the `mounted` / `handleInteraction` block
   with the one below, and change the form to `<form onFocus={handleFocus} onInput={handleInput} …>`.

   ```tsx
   const mounted = useRef(false);
   useEffect(() => {
     mounted.current = true;
   }, []);
   const handleFocus = useCallback(
     (event: React.FocusEvent<HTMLFormElement>) => {
       const target = event.target as HTMLElement;
       if (mounted.current && !target.autofocus) tracker.applicationStarted(token);
     },
     [token]
   );
   const handleInput = useCallback(() => tracker.applicationStarted(token), [token]);
   ```

2. `lib/kit-tracker.ts`: `baseUrl: process.env.NEXT_PUBLIC_STARTUPKIT_BASE_URL || undefined`.
   In `.env.example` (and any real `.env*` file), comment out a blank
   `NEXT_PUBLIC_STARTUPKIT_BASE_URL=` line.
3. Verify: `npm run lint && npm run typecheck && npm run build`; run the site with the key set,
   open `/jobs/<token>/apply` directly (a hard reload, not a click from the job page) and
   DevTools → Network shows no `POST /api/public/v1/events` whose body contains
   `application.started`. Type one character into the first field: exactly one
   `application.started` is sent (batches flush after about a second). Against a fast local API
   the old code may not misfire: it does once the form streams in after hydration, as it does
   with the real Kit API's latency.

#### Prompt for your AI coding agent

````text
This site is a fork of github.com/startupkit-app/nextjs-job-board with Kit analytics already
added. Apply two fixes from that repo's CHANGELOG (Unreleased → Fixed); change nothing else.

1. In the apply form client component (app/jobs/[token]/apply/apply-form.tsx or its
   equivalent), `tracker.applicationStarted` must not fire for the autofocused first field's
   focus. On a direct page load the browser focuses the server-rendered `autofocus` field after
   hydration, so a mounted-ref guard alone does not skip it. Replace the single
   onFocus/onInput handler with two:
   - handleFocus(event: React.FocusEvent<HTMLFormElement>): call
     tracker.applicationStarted(token) only if the mounted ref is set AND
     `(event.target as HTMLElement).autofocus` is false.
   - handleInput(): always call tracker.applicationStarted(token).
   Wire them as <form onFocus={handleFocus} onInput={handleInput}>. Keep the existing
   applicationSubmitted effect unchanged.
2. In lib/kit-tracker.ts pass `baseUrl: process.env.NEXT_PUBLIC_STARTUPKIT_BASE_URL || undefined`
   so an empty string never reaches createTracker. In .env.example, comment out the
   NEXT_PUBLIC_STARTUPKIT_BASE_URL line if it is an empty assignment.
3. Run `npm run lint && npm run typecheck && npm run build` and fix any failure.
4. Tell me to verify in the browser: a hard reload of /jobs/<token>/apply sends no
   application.started in POST /api/public/v1/events; typing one character sends exactly one.
````

## 2026-08-13

### Changed

- Consume `@startupkit-app/jobs` 0.2.0, which declares `application_form.resume.required`; the interim `lib/kit-compat.ts` shim is deleted
- Exempt first-party `@startupkit-app` packages from the npm release cooldown, since they are published from our own repositories via Trusted Publishing
- Dependabot ignores TypeScript 7.0.x and ESLint 10, both of which break `npm run lint` via `eslint-config-next`'s plugin tree
- Bump the transitive `axe-core` to 4.13.0 and `@types/node` to 26.1.2 (development only)

## 2026-08-12

### Fixed

- Webhook revalidation could never authenticate: the endpoint expected a bearer token, but Kit signs deliveries with `X-Webhook-Signature`, so every real delivery was rejected
- Webhook payloads were read from `data.job.id`, which matches no public token, so the per-job cache tag was never busted
- Cache invalidation now covers `paused`, `closed` and `reopened` as well as `published`; a cached page no longer advertises a closed role
- The resume requirement was inferred from a form field the API had stopped sending, so uploads never showed as required and applicants were rejected on submit
- Rate-limit responses (429) on the apply and presign paths now explain what happened instead of falling through to a generic error

### Security

- `.npmrc` sets `min-release-age=7` and `.github/dependabot.yml` mirrors the window, so installs skip versions too new to have been vetted; `engines.npm` declares the 11.10.0 floor the setting needs

### Changed

- `REVALIDATE_SECRET` renamed to `KIT_WEBHOOK_SIGNING_SECRET`, since the value is now Kit's signing secret rather than one the operator chooses
- Dependencies updated to their newest cooldown-eligible versions (Next 16.3.0, React 19.2.8, TypeScript 6.0.3, Tailwind 4.3.3)

## 2026-06-11 — Initial release

### Added

- Next.js 16 App Router job board on Kit's public hiring API: job list with URL-driven filters and pagination, job detail pages, ISR with tag-based revalidation
- Application form rendered from the API schema, covering all field and question types, with inline validation and keyboard/screen-reader support
- Direct-to-storage resume uploads: browser-side MD5, a Server Action presigns, the file PUTs straight to storage
- schema.org `JobPosting` JSON-LD on detail pages, statically generated via `generateStaticParams`
- Optional Cloudflare Turnstile spam protection and an optional webhook revalidation endpoint
- Tailwind CSS v4 styling with dark mode and no UI-kit dependencies

### Security

- API-supplied HTML (`description_html`, `consent_disclosure_html`) is sanitized server-side at the fetch boundary, before any `dangerouslySetInnerHTML`
- Turnstile tokens are required whenever the employer's key has Turnstile configured, matching the API's own verification

### Changed

- Depend on the published `@startupkit-app/jobs` SDK and delete the 300-line local shim; `lib/kit.ts` is the single re-export point
