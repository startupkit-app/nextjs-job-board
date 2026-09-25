# Kit Job Board — Next.js Template

A production-ready careers site built on the [Kit](https://startupkit.app) public hiring API.
Fork it, set one environment variable, and you have a fast, SEO-friendly job board with a
fully dynamic application form — resume uploads, custom questions, Turnstile spam protection,
and instant cache busting via webhooks.

**▶ Live demo: [nextjs-job-board-orcin.vercel.app](https://nextjs-job-board-orcin.vercel.app)** — this template deployed against real Kit job data.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fstartupkit-app%2Fnextjs-job-board&env=STARTUPKIT_SECRET_KEY&envLink=https%3A%2F%2Fstartupkit.app%2Fdocs%2Fpublic-jobs-api%23api-keys)

## Features

- **Next.js App Router** (v16) — Server Components, Server Actions, ISR with tag-based revalidation
- **Job list** with URL-driven filters (department, location, employment type, remote) and pagination
- **Job detail pages** with salary ranges, hiring-process timeline, clearly labelled one-time
  stage payments, and schema.org `JobPosting` JSON-LD (Google for Jobs ready), statically
  generated via `generateStaticParams` + ISR
- **Application form rendered from the API schema** — all 8 field types (text, textarea, file,
  url, select, checkbox, email, phone) and all 3 question types (text, scenario, multiple choice),
  with inline validation errors, character counters, and full keyboard/screen-reader accessibility
- **Direct-to-storage resume uploads** — the browser computes an MD5 checksum, a Server Action
  presigns the upload with your secret key, and the file PUTs straight to storage. Large files
  never touch your Next.js server (no Vercel 4.5 MB body-limit issues), with a real progress bar
- **Talent-pool signup** at `/talent-pool` — a consent-first form for people who like the company
  but not today's openings. The consent checkbox starts unchecked and its disclosure is rendered
  from the API, the visitor's real IP is forwarded so the consent receipt records the person and
  not your server, and Kit confirms the address by double opt-in. Adapting this into your own
  codebase: hand your coding agent [TALENT_POOL.md](TALENT_POOL.md)
- **Optional Kit job analytics** — page views, unique visitors, traffic sources, UTM campaigns,
  countries, devices, landing pages and the view → apply funnel in Kit → Hiring → Analytics,
  reported from the visitor's browser by the SDK's tracker. Set a publishable key and it is on;
  leave it unset and it is a no-op. Adding it to a site forked from an older version of this
  template: hand your coding agent [ANALYTICS.md](ANALYTICS.md)
- **Optional Cloudflare Turnstile** spam protection (progressive enhancement — just set a site key)
- **Optional webhook revalidation** endpoint so newly published jobs appear instantly
- **Tailwind CSS v4**, dark mode, responsive, zero UI-kit dependencies — maximally forkable

## Quick start

### 1. Get an API key

In Kit, go to **Hiring → Career Portal → Public API Keys** and create a key. You need the
**secret key** (`sk_…`). It is only ever used server-side (Server Components and Server
Actions import it through a [`server-only`](https://www.npmjs.com/package/server-only) module),
so it never reaches the browser.

### 2. Deploy

Click the **Deploy** button above and paste your secret key when Vercel asks for
`STARTUPKIT_SECRET_KEY`. Done.

### Or run locally

```bash
git clone https://github.com/startupkit-app/nextjs-job-board
cd nextjs-job-board
npm install
cp .env.example .env.local   # then paste your sk_… key
npm run dev
```

## Customize with an AI coding agent

The repo ships an [AGENTS.md](AGENTS.md) (imported by [CLAUDE.md](CLAUDE.md)) that tells coding
agents how the site is built, which files to touch for common changes, and which contracts to
leave alone. To make the site yours:

1. Fork or clone the repo, `npm install`, and put your `sk_…` key in `.env.local`.
2. Open the folder in [Claude Code](https://claude.com/claude-code) (`claude`) or
   [Codex](https://openai.com/codex) (`codex`). Both read the agent instructions automatically.
3. Ask for what you want, for example:
   - "Use our brand color #0f766e and the Inter font, and put `logo.svg` in the header."
   - "Add a /team page with our four founders and link it from the header."
   - "Show the job list as a two-column grid grouped by department."
   - "Translate the site into German."
   - "Show the application form directly on each job page."
4. Check the result with `npm run dev`; the agent runs `npm run lint`, `npm run typecheck` and
   `npm run build` before it finishes.
5. Push and deploy with the button above (or redeploy your existing Vercel project).

## Environment variables

| Variable                         | Required | Description                                                                 |
| -------------------------------- | -------- | --------------------------------------------------------------------------- |
| `STARTUPKIT_SECRET_KEY`          | **Yes**  | Secret API key (`sk_…`) from Kit → Hiring → Career Portal → Public API Keys |
| `STARTUPKIT_BASE_URL`            | No       | API base URL. Defaults to `https://app.startupkit.app`                      |
| `NEXT_PUBLIC_STARTUPKIT_PUBLISHABLE_KEY` | No | Publishable key (`pk_…`) for browser-side job analytics. Unset = analytics off |
| `NEXT_PUBLIC_STARTUPKIT_BASE_URL` | No      | Browser-side counterpart of `STARTUPKIT_BASE_URL`, for a custom Kit domain only |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | No       | Cloudflare Turnstile site key — renders the widget on the apply form        |
| `KIT_WEBHOOK_SIGNING_SECRET`     | No       | Signing secret of the Kit webhook endpoint targeting `POST /api/revalidate` |
| `NEXT_PUBLIC_COMPANY_NAME`       | No       | Company name for the header, titles, and JobPosting structured data         |

## How freshness works (ISR + webhooks)

All API reads go through Next.js' data cache:

- Job list: `revalidate: 60`, tagged `jobs`
- Job detail / apply form: `revalidate: 300`, tagged `jobs` and `job-<token>`
- Talent-pool form: `revalidate: 300`, tagged `talent-pool`

So the site is never more than a minute or two stale, with zero configuration. For **instant**
updates, create a webhook endpoint in Kit (Integrations → Webhooks) pointing at:

```
POST https://your-site.example/api/revalidate
```

and set `KIT_WEBHOOK_SIGNING_SECRET` to that endpoint's signing secret.

Kit authenticates deliveries by **signature**, not by a shared bearer token — it sends
`X-Webhook-Signature` (HMAC-SHA256 of `<timestamp>.<body>`, hex) alongside `X-Webhook-Timestamp`
and `X-Webhook-Event`, and cannot attach a custom `Authorization` header. The route recomputes
the HMAC over the raw request body and rejects anything that does not match, or whose timestamp
is more than 5 minutes old.

Subscribe to the job lifecycle events:

- `job_posting.published` / `job_posting.reopened` — the role becomes visible on the public API
- `job_posting.paused` / `job_posting.closed` — the role starts returning 404

All four bust both the `jobs` list tag and that job's `job-<token>` tag. Pausing and closing
matter as much as publishing: without them a cached page keeps advertising a role that is no
longer open. `application.*` events refresh just the job they belong to, which is useful if
roles auto-close at an application cap.

Two things webhooks do **not** cover, so the ISR window still earns its keep: Kit emits no
`job_posting.updated` event, so edits to a job's title or description are not pushed; and
reverting a job to draft fires no event at all even though it removes the job from the API.

## Analytics

Kit's **Hiring → Analytics** dashboard is fed by page events. Kit's hosted career portal sends
them itself; a headless site has to, or the dashboard stays empty. Pages here are ISR-cached,
so the events are sent from the visitor's browser by the SDK's `createTracker`
([`lib/kit-tracker.ts`](lib/kit-tracker.ts)), and Kit records them as the same events the
hosted portal writes, so every chart fills in unchanged:

| Event                   | Sent from                                                           |
| ----------------------- | ------------------------------------------------------------------- |
| `job_board.viewed`      | `<TrackJobBoardView />` on the job list                             |
| `job.viewed`            | `<TrackJobView job={…} />` on the job detail page                   |
| `application.started`   | first keystroke, or focus other than autofocus, in the apply form   |
| `application.submitted` | the apply form's success state                                      |
| `talent_pool.joined`    | the talent-pool form's success state                                |

To turn it on, set `NEXT_PUBLIC_STARTUPKIT_PUBLISHABLE_KEY` to a **publishable** key (`pk_…`)
from Kit → Hiring → Career Portal → Public API Keys. Only a publishable key works: visitor
identity (masked IP + user agent) and geo are read from the browser's own request, so a
server-side relay would count every visitor as your server, and the tracker refuses an
`sk_…` key outright. If the key has an origin allowlist, your site's origin (e.g.
`https://careers.example.com`) must be on it, or every batch is a 403 `origin_not_allowed`.

Verify: open a job page, and DevTools → Network shows `POST /api/public/v1/events` → `202`
within a second; Kit → Hiring → Analytics shows the view shortly after. Without the key
nothing is sent and nothing logs. In development, tracker errors (bad key, missing origin,
a Kit server without the endpoint yet) are `console.warn`ed; in production they are silent,
and the page is never affected either way.

## About the SDK

This template talks to Kit through the published **[`@startupkit-app/jobs`](https://www.npmjs.com/package/@startupkit-app/jobs)**
package. [`lib/kit.ts`](lib/kit.ts) is the single place that imports it: it re-exports the types
and exposes a `kit` client authenticated with the secret key. That module is marked `server-only`,
so the key can never be bundled into a client component.

[`lib/kit-tracker.ts`](lib/kit-tracker.ts) is the one other import: the browser-side analytics
tracker, which only ever sees the publishable key.

The dependency is pinned as `^0.5.0`. A caret on a `0.x` version does not cross minor releases,
so picking up a new SDK minor is always a deliberate edit here rather than something `npm install`
does on its own — worth knowing when the API grows a field the template wants to read.

## API surface used

Base URL `https://app.startupkit.app`, auth via `Authorization: Bearer sk_…`:

| Endpoint                                       | Used for                                                  |
| ---------------------------------------------- | --------------------------------------------------------- |
| `GET /api/public/v1/jobs`                      | Job list, filters, pagination, `generateStaticParams`      |
| `GET /api/public/v1/jobs/:public_token`        | Job detail, application form schema, JSON-LD               |
| `POST /api/public/v1/direct_uploads`           | Presigning resume/file uploads (server action)             |
| `POST /api/public/v1/jobs/:token/applications` | Submitting applications (server action)                    |
| `GET /api/public/v1/talent_pool`               | Talent-pool form schema: fields, consent terms, resume     |
| `POST /api/public/v1/talent_pool/entries`      | Talent-pool signups (server action)                        |
| `POST /api/public/v1/events`                   | Job analytics events, from the browser with the `pk_…` key |

Error responses (`{ "error": { "code", "message", "fields" } }`) are surfaced as inline form
errors; `already_applied` (409), `already_in_talent_pool` (409), `consent_required` (422) and
`turnstile_failed` (422) get friendly dedicated messages.

On job details, hiring stages may include an optional
`compensation: { amount, currency }` object. The timeline labels the stage as **eligible for a
one-time payment** after completion, separately from the job's recurring salary. Older API
responses that omit `compensation` render exactly as before. This template consumes that field
through `@startupkit-app/jobs` 0.4 or newer.

## Project structure

```
app/
  page.tsx                     # Job list (ISR 60s, tag "jobs") + filters + pagination
  layout.tsx                   # Shell: header, footer, skip link
  loading.tsx / error.tsx / not-found.tsx
  opengraph-image.tsx          # Branded OG image
  jobs/[token]/
    page.tsx                   # Job detail (ISR 300s, JSON-LD, generateStaticParams)
    loading.tsx
    apply/
      page.tsx                 # Fetches the form schema server-side
      apply-form.tsx           # Client: dynamic field/question renderer, useActionState
      actions.ts               # Server Action: submitApplication
  talent-pool/
    page.tsx                   # Talent-pool schema + consent terms (ISR 300s)
    signup-form.tsx            # Client: consent-first signup form, useActionState
    actions.ts                 # Server Action: joinTalentPool (forwards the consent IP)
  api/revalidate/route.ts      # Optional webhook → revalidateTag
components/
  file-upload.tsx              # Client: MD5 → presign → direct PUT with progress
  kit-analytics.tsx            # Client: <TrackJobBoardView /> + <TrackJobView /> page-view events
  hiring-process.tsx           # Responsive stage timeline + optional one-time payments
  job-card.tsx  job-filters.tsx  salary.tsx  empty-state.tsx  turnstile.tsx
lib/
  kit.ts                       # server-only client instance + re-exported SDK types
  kit-tracker.ts               # browser analytics tracker (publishable key, no-op without one)
  kit-errors.ts                # shared submission-failure copy + API field-error shaping
  upload-actions.ts            # Server Action: createFileUpload (presign), shared by both forms
  md5.ts                       # vendored MD5 (base64) for upload checksums
  jsonld.ts                    # schema.org JobPosting builder
  sanitize.ts                  # HTML sanitizer for API-supplied markup
  format.ts  jobs.ts  talent-pool.ts  # display helpers, cached job + talent-pool fetchers
```

## Scripts

```bash
npm run dev         # start the dev server
npm run build       # production build
npm run start       # serve the production build
npm run lint        # eslint
npm run typecheck   # tsc --noEmit
```

## Changelog

Notable changes are recorded in [CHANGELOG.md](CHANGELOG.md).

## License

[MIT](LICENSE)
