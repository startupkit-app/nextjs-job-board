# Kit Job Board — Next.js Template

A production-ready careers site built on the [Kit](https://startupkit.app) public hiring API.
Fork it, set one environment variable, and you have a fast, SEO-friendly job board with a
fully dynamic application form — resume uploads, custom questions, Turnstile spam protection,
and instant cache busting via webhooks.

**▶ Live demo: [nextjs-job-board-orcin.vercel.app](https://nextjs-job-board-orcin.vercel.app)** — this template deployed against real Kit job data.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/startupkit-app/nextjs-job-board&env=STARTUPKIT_SECRET_KEY&envDescription=Secret%20API%20key%20from%20Kit%20Settings&envLink=https://startupkit.app/docs/public-jobs-api&demo-title=Kit%20Job%20Board&demo-description=A%20careers%20site%20on%20the%20Kit%20public%20hiring%20API&demo-url=https://nextjs-job-board-orcin.vercel.app)

## Features

- **Next.js App Router** (v16) — Server Components, Server Actions, ISR with tag-based revalidation
- **Job list** with URL-driven filters (department, location, employment type, remote) and pagination
- **Job detail pages** with salary ranges, hiring-process timeline, and schema.org `JobPosting`
  JSON-LD (Google for Jobs ready), statically generated via `generateStaticParams` + ISR
- **Application form rendered from the API schema** — all 8 field types (text, textarea, file,
  url, select, checkbox, email, phone) and all 3 question types (text, scenario, multiple choice),
  with inline validation errors, character counters, and full keyboard/screen-reader accessibility
- **Direct-to-storage resume uploads** — the browser computes an MD5 checksum, a Server Action
  presigns the upload with your secret key, and the file PUTs straight to storage. Large files
  never touch your Next.js server (no Vercel 4.5 MB body-limit issues), with a real progress bar
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

## Environment variables

| Variable                         | Required | Description                                                                 |
| -------------------------------- | -------- | --------------------------------------------------------------------------- |
| `STARTUPKIT_SECRET_KEY`          | **Yes**  | Secret API key (`sk_…`) from Kit → Hiring → Career Portal → Public API Keys |
| `STARTUPKIT_BASE_URL`            | No       | API base URL. Defaults to `https://app.startupkit.app`                      |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | No       | Cloudflare Turnstile site key — renders the widget on the apply form        |
| `KIT_WEBHOOK_SIGNING_SECRET`     | No       | Signing secret of the Kit webhook endpoint targeting `POST /api/revalidate` |
| `NEXT_PUBLIC_COMPANY_NAME`       | No       | Company name for the header, titles, and JobPosting structured data         |

## How freshness works (ISR + webhooks)

All API reads go through Next.js' data cache:

- Job list: `revalidate: 60`, tagged `jobs`
- Job detail / apply form: `revalidate: 300`, tagged `jobs` and `job-<token>`

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

## About the SDK

This template talks to Kit through the published **[`@startupkit-app/jobs`](https://www.npmjs.com/package/@startupkit-app/jobs)**
package. [`lib/kit.ts`](lib/kit.ts) is the single place that imports it: it re-exports the types
and exposes a `kit` client authenticated with the secret key. That module is marked `server-only`,
so the key can never be bundled into a client component.

[`lib/kit-compat.ts`](lib/kit-compat.ts) is a small companion holding shims for fields the API
already returns but the pinned SDK version does not yet declare in its types. It imports only
types from `lib/kit.ts`, which are erased at compile time, so it stays safe to use from client
components. It should shrink to nothing as the SDK catches up.

## API surface used

Base URL `https://app.startupkit.app`, auth via `Authorization: Bearer sk_…`:

| Endpoint                                       | Used for                                                  |
| ---------------------------------------------- | --------------------------------------------------------- |
| `GET /api/public/v1/jobs`                      | Job list, filters, pagination, `generateStaticParams`      |
| `GET /api/public/v1/jobs/:public_token`        | Job detail, application form schema, JSON-LD               |
| `POST /api/public/v1/direct_uploads`           | Presigning resume/file uploads (server action)             |
| `POST /api/public/v1/jobs/:token/applications` | Submitting applications (server action)                    |

Error responses (`{ "error": { "code", "message", "fields" } }`) are surfaced as inline form
errors; `already_applied` (409) and `turnstile_failed` (422) get friendly dedicated messages.

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
      actions.ts               # Server Actions: submitApplication, createResumeUpload
      resume-upload.tsx        # Client: MD5 → presign → direct PUT with progress
  api/revalidate/route.ts      # Optional webhook → revalidateTag
components/
  job-card.tsx  job-filters.tsx  salary.tsx  empty-state.tsx  turnstile.tsx
lib/
  kit.ts                       # server-only client instance (swap point for the real SDK)
  kit-sdk-shim.ts              # typed API client + all contract types
  md5.ts                       # vendored MD5 (base64) for upload checksums
  jsonld.ts                    # schema.org JobPosting builder
  format.ts  jobs.ts           # display helpers, shared job fetcher
```

## Scripts

```bash
npm run dev         # start the dev server
npm run build       # production build
npm run start       # serve the production build
npm run lint        # eslint
npm run typecheck   # tsc --noEmit
```

## License

[MIT](LICENSE)
