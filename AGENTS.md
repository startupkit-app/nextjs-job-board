# AGENTS.md

Instructions for coding agents (Claude Code, Codex, Cursor, and others) working in this repo.
Humans: start with [README.md](README.md).

## What this is

A careers site (job list, job detail, application form, talent-pool signup) built with Next.js
on top of Kit's public hiring API ([startupkit.app](https://startupkit.app)). Kit owns the
data: jobs are published in Kit, and applications and talent-pool signups are submitted back
into the company's Kit pipeline. This repo only renders and submits; it has no database. Companies
fork it, restyle it, and deploy it to Vercel.

## Stack and commands

Next.js 16 (App Router, Server Components, Server Actions, ISR), React 19, TypeScript,
Tailwind CSS v4 (CSS-first, no `tailwind.config.*`), ESLint 9. Node >= 20.19.0, npm >= 11.10.0
(`.npmrc` uses `min-release-age`, which older npm silently ignores). One runtime dependency
talks to Kit: [`@startupkit-app/jobs`](https://www.npmjs.com/package/@startupkit-app/jobs).

```bash
npm install          # or `npm ci` for a clean install from package-lock.json
npm run dev          # dev server on http://localhost:3000
npm run build        # production build
npm run start        # serve the production build
npm run lint         # eslint .
npm run typecheck    # tsc --noEmit
```

There is no test suite and no `test` script. Verification is `npm run lint && npm run
typecheck && npm run build`, plus clicking through the pages in `npm run dev`.

`npm run build` calls the Kit API when `STARTUPKIT_SECRET_KEY` is set (it prerenders
`/talent-pool` and the job pages), so an invalid key fails the build with `KitApiError: Invalid
or missing API key`. With the variable unset, the build succeeds and pages show the setup notice.

## Environment variables

Copy `.env.example` to `.env.local`. `.env*` files are gitignored (except `.env.example`).

| Variable | Required | What it does |
| --- | --- | --- |
| `STARTUPKIT_SECRET_KEY` | Yes | Secret key (`sk_…`). Server-only: read in `lib/kit.ts`. Without it every page renders `<SetupNotice />` instead of calling the API. |
| `STARTUPKIT_BASE_URL` | No | Kit API base URL. Defaults to `https://app.startupkit.app`; change only for a custom Kit domain. |
| `NEXT_PUBLIC_STARTUPKIT_PUBLISHABLE_KEY` | No | Publishable key (`pk_…`) for browser-side job analytics. Unset = analytics off. |
| `NEXT_PUBLIC_STARTUPKIT_BASE_URL` | No | Browser counterpart of `STARTUPKIT_BASE_URL`. Set only alongside it; keep it commented out otherwise (a blank value used to crash the tracker). |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | No | Cloudflare Turnstile site key, used when the API's form schema carries no `sitekey`; renders the widget on the apply and talent-pool forms. |
| `KIT_WEBHOOK_SIGNING_SECRET` | No | Signing secret of the Kit webhook endpoint pointing at `POST /api/revalidate`. Enables instant cache busting. |
| `NEXT_PUBLIC_COMPANY_NAME` | No | Company name in the header, footer, page titles, OG image and JobPosting JSON-LD. |

Where to get the keys: in Kit, **Hiring → Career Portal → Public API Keys**
(<https://startupkit.app/docs/public-jobs-api#api-keys>). The secret key is shown only once,
when created or rotated. The webhook signing secret comes from **Integrations → Webhooks** when
the endpoint is created.

## Project map

```
app/
  layout.tsx                 # Shell: skip link, header (logo + nav), footer, <html lang>, site metadata
  globals.css                # Tailwind import, body font + colors, .job-description rich-text styles
  page.tsx                   # Job list: filters, pagination (PER_PAGE = 20), ISR 60s
  loading.tsx error.tsx not-found.tsx
  opengraph-image.tsx        # Generated OG image (inline hex colors, company initial)
  jobs/[token]/page.tsx      # Job detail: badges, salary, description, hiring process, JSON-LD
  jobs/[token]/apply/
    page.tsx                 # Apply page (server): fetches the job, renders <ApplyForm />
    apply-form.tsx           # Client form rendered from the API's application_form schema
    validation.ts            # Client-side mirror of the server checks
    actions.ts               # Server Action submitApplication: rebuilds payload, calls kit.apply
  talent-pool/               # page.tsx, signup-form.tsx (client), actions.ts (joinTalentPool)
  api/revalidate/route.ts    # Kit webhook receiver: HMAC check, revalidateTag
components/                  # job-card, job-filters, salary, hiring-process, file-upload,
                             # turnstile, kit-analytics, empty-state, setup-notice
lib/
  kit.ts                     # server-only Kit client (secret key) + re-exported SDK types
  jobs.ts talent-pool.ts     # Cached fetchers (fetchJob, fetchTalentPool) + HTML sanitizing
  upload-actions.ts          # Server Action createFileUpload (presigned upload)
  kit-errors.ts              # Shared error copy + API field-error shaping
  kit-tracker.ts             # Browser analytics tracker (publishable key only)
  format.ts                  # Labels, dates, currency ("en"/"en-US" Intl formatting)
  jsonld.ts sanitize.ts md5.ts
```

Styling is Tailwind utility classes inline in each component; there is no theme file, no UI kit
and no `public/` directory yet. There is no i18n: all UI copy is English, hard-coded in the
components and in the error messages of `actions.ts`, `validation.ts` and `lib/kit-errors.ts`.

## How data flows

All API calls go through `kit` from `lib/kit.ts` (an `@startupkit-app/jobs` client authenticated
with `STARTUPKIT_SECRET_KEY`), so they only run in Server Components and Server Actions. The one
exception is analytics, sent from the browser with the publishable key by `lib/kit-tracker.ts`.

| Endpoint (under `STARTUPKIT_BASE_URL`) | SDK call | Called from |
| --- | --- | --- |
| `GET /api/public/v1/jobs` | `kit.listJobs` | `app/page.tsx`, `generateStaticParams` in `app/jobs/[token]/page.tsx` |
| `GET /api/public/v1/jobs/:token` | `kit.getJob` | `fetchJob` in `lib/jobs.ts` (detail, apply page, apply action) |
| `POST /api/public/v1/direct_uploads` | `kit.createUpload` | `lib/upload-actions.ts`; the browser then PUTs the file to storage (`components/file-upload.tsx`) |
| `POST /api/public/v1/jobs/:token/applications` | `kit.apply` | `app/jobs/[token]/apply/actions.ts` |
| `GET /api/public/v1/talent_pool` | `kit.getTalentPool` | `fetchTalentPool` in `lib/talent-pool.ts` |
| `POST /api/public/v1/talent_pool/entries` | `kit.joinTalentPool` | `app/talent-pool/actions.ts` |
| `POST /api/public/v1/events` | `createTracker` | `lib/kit-tracker.ts`, from the visitor's browser |

Caching: job list `revalidate: 60` tagged `jobs`; job detail and apply form 300s tagged `jobs` +
`job-<token>`; talent pool 300s tagged `talent-pool`. `app/api/revalidate/route.ts` busts those
tags when Kit sends `job_posting.*` / `application.*` webhooks. A job's `id` from the API is its
public token and is the `[token]` route param.

## Customisation recipes

**Brand colors.** The accent is Tailwind's `indigo-*`, hard-coded across `app/` and
`components/` (`grep -rn indigo app components` lists every use). Either override the palette
once in `app/globals.css` with `@theme { --color-indigo-500: …; --color-indigo-600: …; }`
(fastest), or define `--color-brand-50` … `--color-brand-950` in `@theme` and replace `indigo-`
with `brand-` everywhere. Neutrals are `zinc-*` (body colors live in `globals.css`). Update the
hex values in `app/opengraph-image.tsx` too; it cannot use Tailwind. Keep every `dark:` variant
and check text contrast (WCAG AA, 4.5:1) in both themes.

**Fonts.** The body uses a system font stack set in `app/globals.css`. To use a web font, load it
with `next/font/google` (or `next/font/local`) in `app/layout.tsx`, expose it as a CSS variable
on `<html>`, set `--font-sans: var(--font-…)` inside `@theme` in `globals.css`, and delete the
`font-family` block on `body`.

**Logo and favicon.** The header logo in `app/layout.tsx` is a colored square with the company's
initial. Add the file under `public/` (e.g. `public/logo.svg`, create the directory) and replace
that `<span>` with `next/image` or `<img>` whose `alt` is the company name. Add a favicon as
`app/icon.png` or `app/icon.svg` (Next.js file convention). Mirror the logo in
`app/opengraph-image.tsx` if wanted. Company name: `NEXT_PUBLIC_COMPANY_NAME`.

**Add a page (team, about, benefits).** Create `app/team/page.tsx` exporting `metadata` with a
`title` and rendering static content inside the existing `max-w-4xl` main column; team data
lives in the repo (Kit's public API has no team endpoint). Add a link to the header nav in
`app/layout.tsx`, next to "Open roles". Put images in `public/` and give them real `alt` text.

**Job list layout.** `app/page.tsx` owns the list (`<ul className="space-y-3">`), heading, empty
state and pagination (`PER_PAGE`); `components/job-card.tsx` is one row; `components/job-filters.tsx`
is the URL-driven filter bar (filters are search params: `department`, `location`,
`employment_type`, `remote`, `page`). For a grid, change the `<ul>` classes and the card. To
group by department, group `jobs` in `app/page.tsx`, but note it only sees the current page:
raise `PER_PAGE` (the facet query already uses `per_page: 100`) or drop pagination.

**Add a language.** Job titles, descriptions, form labels and questions come from Kit exactly as
authored there; translate those in Kit. Everything else is English in code. For a single other
language: translate the copy in `app/`, `components/`, `app/**/actions.ts`, `validation.ts` and
`lib/kit-errors.ts`, set `<html lang>` in `app/layout.tsx`, and change the `"en"`/`"en-US"`
locales in `lib/format.ts` and `components/salary.tsx` (also the English labels there). For
several languages: move the pages under `app/[lang]/` (leave `app/api/` where it is), keep copy in
per-locale dictionaries, detect the locale in `proxy.ts` (Next 16's name for middleware), and add
`alternates.languages` to page metadata.

**Put the application form on the job page.** The form is `<ApplyForm token jobTitle form />`
from `app/jobs/[token]/apply/apply-form.tsx`, fed by `fetchJob`. To show it inline, render
`<ApplyForm token={job.id} jobTitle={job.title} form={job.application_form} />` in
`app/jobs/[token]/page.tsx` when `job.accepting_applications` is true, and point the apply
buttons at an anchor. Disable its autofocus there (the first core field sets
`autoFocus={index === 0 && …}`; add a prop), otherwise the page jumps to the form on load. Keep
the `/jobs/[token]/apply` route working: Kit and job boards link to it. To embed jobs on a
different website, use Kit's hosted embed instead (<https://startupkit.app/docs/embedding-your-career-portal>).

## Rules

- **Never commit secrets.** No real keys in code, `.env.example`, README or commits. The `sk_…`
  key is read only in `lib/kit.ts`, which imports `server-only`; never import `lib/kit.ts` (or
  `lib/jobs.ts`, `lib/talent-pool.ts`) from a `"use client"` file, and never put an `sk_…` key in
  a `NEXT_PUBLIC_` variable.
- **Keep the application POST contract.** `submitApplication` rebuilds the payload from the API's
  own schema, never from the client: core fields `email`, `first_name`, `last_name`, `phone` at
  the top level; other fields as `field:<name>`, questions as `question:<key>` (both into
  `responses`); extra files as `file:<name>` (into `files`); the resume as `resume_signed_id`;
  Turnstile as `turnstile_token`. Keep those input names, the server-side required checks, and
  the dedicated handling of `already_applied`, `turnstile_failed` and 429. Same for the talent
  pool: the consent checkbox starts unchecked, `consent: true` is sent only when ticked, and
  `consent_ip_address` is forwarded.
- **Keep sanitizing API HTML at the fetch boundary** (`lib/jobs.ts`, `lib/talent-pool.ts` via
  `lib/sanitize.ts`) before any `dangerouslySetInnerHTML`.
- **Keep accessibility.** Every control has a `<label>` (visible on forms, `sr-only` on the
  filter bar); errors use `aria-invalid` +
  `aria-describedby`; keep the skip link, focus-visible styles, heading order, `alt` text, `dark:`
  variants, and full keyboard use of forms and filters.
- **Pages that fetch at build time keep the `kitConfigured` / `<SetupNotice />` guard,** so a fork
  without a key still builds. Route segment `export const revalidate = …` must be a literal.
- **Analytics stays in the browser** with the publishable key; see [ANALYTICS.md](ANALYTICS.md)
  before touching `lib/kit-tracker.ts` or the tracking calls.
- **Dependencies:** keep `.npmrc` (release cooldown). `@startupkit-app/jobs` is `^0.5.0`; a caret
  on `0.x` does not cross minors, so upgrading it is a deliberate edit.
- **Before finishing,** run `npm run lint && npm run typecheck && npm run build` and fix what
  fails. Add a `CHANGELOG.md` entry for template changes (upgrade note + paste-ready agent prompt).

## Deploy

Vercel: use the **Deploy with Vercel** button in the README, or import the repo at
<https://vercel.com/new>. Set `STARTUPKIT_SECRET_KEY` (and any optional variables) under
Project → Settings → Environment Variables, then redeploy; `NEXT_PUBLIC_*` values are inlined at
build time, so changing them needs a new build. For instant updates, add a Kit webhook to
`https://<your-domain>/api/revalidate` and set `KIT_WEBHOOK_SIGNING_SECRET`. If the publishable
key has an origin allowlist, add the production domain to it. Any Node host that runs
`npm run build && npm run start` works too.
