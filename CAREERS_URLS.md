# Careers URL contract

Kit can send job-board visitors to your own careers site while keeping the shared job link
under your Kit portal. This template already serves the required job pages.

## Routes to keep

| Page | Required path | Identifier |
| --- | --- | --- |
| Careers homepage | Your configured external URL | — |
| Job description | External URL + `/jobs/:public_token` | `job.id` from the public jobs API |

For `https://careers.example.com`, a job lands at
`https://careers.example.com/jobs/abc123`. For `https://example.com/careers`, it lands at
`https://example.com/careers/jobs/abc123`. Kit appends the job path; the configured URL is
the homepage, not a job URL or a URL pattern.

Keep `/jobs/[token]` reachable even if your design also uses title slugs. Titles can change;
the public token stays stable. Resolve the token through the public API and show a missing-job
page when it is unknown or unpublished. Never substitute an internal database ID.

If you deploy under `/careers`, set Next.js `basePath: "/careers"` in `next.config.ts`
and rebuild. Next.js adds the prefix to this template's `Link` URLs. Configure the same
full homepage URL in Kit; do not add the prefix again to `jobPath`.

## Enable in Kit

Deploy and verify a real `/jobs/<public_token>` page first. In **Hiring → Career Portal**,
choose the external careers homepage, enter its URL, and enable external job pages.
Homepage redirection alone does not enable job redirection.

Kit's job-board distribution and feeds share a Kit job URL with `destination=careers`.
When external job pages are enabled, opening that link sends the visitor to the matching
external `/jobs/:public_token` page. Without the opt-in, it opens the Kit job page. This
lets an existing distributed link follow your current portal settings.

Kit forwards campaign UTM parameters and `locale`. The `destination` parameter is a Kit
routing control: do not copy it into your own links, and do not link your description page
back to the marked Kit job URL; that would send visitors straight back here.

## Applications and attribution

Kit's application, candidate sign-in and talent-pool links continue to work on Kit.
This template also keeps its existing API-backed application form at
`/jobs/:public_token/apply`. `JobLink` carries `utm_source`, `utm_medium`, `utm_campaign`,
`utm_term`, `utm_content` and `locale` between job cards, descriptions and application forms.
It reads them in the browser, so job pages retain ISR caching.

With a publishable analytics key, the SDK reads the browser URL to attribute job views and
application events. Application submission itself uses the existing public API payload;
the template does not add campaign fields to candidate responses. `locale` is preserved
for forks with localized pages; this template's interface remains English.

## Verify your deployment

1. Open a live external job URL directly, with `?utm_source=job-board&utm_campaign=hiring`.
2. Choose **Apply for this role** and confirm those parameters remain on the form URL.
3. Open the Kit distributed job link with `destination=careers` and confirm it reaches the
   same job, including the configured homepage path prefix.
4. Disable external job pages and confirm the same Kit link displays Kit's job page.
5. Check unknown and unpublished tokens show a missing-job page, not the homepage.

For local route checks, run `node --test test/job-paths.test.mjs` on Node 22.18 or newer
(native TypeScript stripping), plus `npm run lint`, `npm run typecheck` and `npm run build`.
