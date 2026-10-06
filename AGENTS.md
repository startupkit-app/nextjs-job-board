# AGENTS.md

Next.js App Router careers-site template on the Kit (startupkit.app) public hiring API, via `@startupkit-app/jobs`. Meant to be forked; keep it dependency-light (no UI kit, minimal `next.config.ts`).

## Commands

- `npm run dev` / `npm run build` / `npm run start`
- `npm run lint` (eslint, `eslint-config-next` core-web-vitals + typescript)
- `npm run typecheck` (`tsc --noEmit`)
- `npm test` runs route/attribution helpers (Node 22.18+; Node 24 in CI).
- `npm run test:browser` builds the actual app with a local fixture API, then runs native Playwright against root and `/careers` deployments. Install Chromium once with `npx playwright install chromium`. No real API key or customer data is used. The harness excludes `.env*` files and overrides SDK/analytics/Turnstile configuration.
- `.github/workflows/browser.yml` runs lint, typecheck, helper tests and browser regressions on PRs/main. Dependabot updates dependencies weekly with a 7-day cooldown.
- `.npmrc` sets `min-release-age=7`; npm below the `engines` floor silently ignores it. `@startupkit-app/*` is exempt from the cooldown.
- Do not bump `typescript` to 7.0.x or `eslint` to 10.x: both break `npm run lint` through `eslint-config-next`'s nested plugins (see comments in dependabot.yml).

## Env (`.env.example` -> `.env.local`)

- `STARTUPKIT_SECRET_KEY` (required) Kit `sk_` key; server-only.
- `STARTUPKIT_BASE_URL` API base, defaults to `https://app.startupkit.app`.
- `NEXT_PUBLIC_STARTUPKIT_PUBLISHABLE_KEY` Kit `pk_` key for browser analytics; empty = analytics off.
- `NEXT_PUBLIC_STARTUPKIT_BASE_URL` browser counterpart of `STARTUPKIT_BASE_URL`; set only with a custom base URL.
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` renders Cloudflare Turnstile on the apply form.
- `KIT_WEBHOOK_SIGNING_SECRET` HMAC secret for `POST /api/revalidate`; Kit generates it, not you.
- `NEXT_PUBLIC_COMPANY_NAME` header, titles, JobPosting JSON-LD.
- Without the secret key, pages render `components/setup-notice.tsx` instead of failing (`kitConfigured` in `lib/kit.ts`).

## Layout

- `@startupkit-app/jobs` is imported in exactly two places: `lib/kit.ts` (secret-key client + re-exported types, `server-only`) and `lib/kit-tracker.ts` (`pk_` analytics tracker, client-safe on purpose). Everything else imports from those.
- `lib/jobs.ts`, `lib/talent-pool.ts` cached fetchers; `lib/sanitize.ts` HTML sanitizer; `lib/upload-actions.ts` presign Server Action shared by both forms; `lib/kit-errors.ts` API error -> form error shaping; `lib/md5.ts` vendored MD5 for upload checksums.
- `app/page.tsx` job list; `app/jobs/[token]/` detail + `apply/` (form, `actions.ts`, `validation.ts`); `app/talent-pool/`; `app/api/revalidate/route.ts` webhook.
- `components/`: shared UI. Client components: `file-upload.tsx`, `turnstile.tsx`, `job-filters.tsx` (URL-driven filter state), `kit-analytics.tsx` (view tracking).
- Path alias `@/*` -> repo root.

## Conventions and gotchas

- External careers routing contract: keep `/jobs/[token]` keyed by the API's `job.id` public token; see `CAREERS_URLS.md`. Use `lib/job-paths.ts` for encoded routes and `JobLink` for job/apply navigation that preserves allowlisted campaign parameters. Public Kit job URLs follow the external-job setting; linking back to a hosted Kit description requires `destination=kit` to avoid a redirect loop. Kit's dedicated `/:public_token/apply` URL stays on Kit; this template's `/jobs/:public_token/apply` form stays local. With a Next.js `basePath`, do not hard-code that prefix in these helpers.

- The secret key must never reach the browser. Anything touching `kit` or `process.env.STARTUPKIT_SECRET_KEY` stays in Server Components, Server Actions, or a `server-only` module. Do not add SDK imports elsewhere, and never put the `sk_` key in `lib/kit-tracker.ts`.
- API HTML (`description_html`, `consent_disclosure_html`, `consent.disclosure_html`) is sanitized with `sanitize-html` in the fetchers (`lib/jobs.ts`, `lib/talent-pool.ts`) before it reaches any render site. If you add a new HTML field from the API, sanitize it there, not in the component.
- Caching: list `revalidate: 60` tag `jobs`; job detail/apply `revalidate: 300` tags `jobs` + `job-<token>`; talent pool `revalidate: 300` tag `talent-pool`. The webhook route calls `revalidateTag(tag, "max")`. Keep new fetches on these tags or the webhook will not bust them.
- Webhook auth is signature-based (`X-Webhook-Signature` HMAC-SHA256 over `<timestamp>.<body>`, 5-minute window), not a bearer token. Read the raw body before parsing.
- File uploads never hit the Next.js server: browser MD5 -> `createFileUpload` presign -> direct PUT. Do not route file bytes through a Server Action (Vercel 4.5 MB body limit).
- Talent pool: consent checkbox unchecked by default; Server Action forwards first hop of `x-forwarded-for` as `consent_ip_address`. See `TALENT_POOL.md`.
- Forms use `useActionState`; API errors map through `lib/kit-errors.ts` (`already_applied`, `already_in_talent_pool`, `consent_required`, `turnstile_failed` have dedicated copy).
- Analytics fire from the browser only, once per view (ref guard vs StrictMode), submit events on success only. See `ANALYTICS.md`.
- Tailwind via `@tailwindcss/postcss`; no `tailwind.config` file, theme lives in `app/globals.css`.

## Docs

- Kit public jobs API: https://startupkit.app/docs/public-jobs-api
- SDK: `node_modules/@startupkit-app/jobs/README.md` (source: https://github.com/startupkit-app/jobs-js)
- Next.js, version-matched: `node_modules/next/dist/docs/` (`01-app/` for App Router); online at https://nextjs.org/docs
- Tailwind: https://tailwindcss.com/docs
- Turnstile: https://developers.cloudflare.com/turnstile/
