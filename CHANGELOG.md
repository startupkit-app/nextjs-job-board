# Changelog

Notable changes to this template, in the format of [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
The template is a fork-and-deploy starter rather than a published package: it has never been
tagged or released to a registry, so entries are grouped by date instead of version number.

## [Unreleased]

### Added

- Talent-pool signup page at `/talent-pool`, rendered from `GET /api/public/v1/talent_pool` and submitted to `POST /api/public/v1/talent_pool/entries`
- Consent checkbox that starts unchecked, labelled with the API's disclosure HTML (sanitized server-side at the fetch boundary)
- The visitor's IP is forwarded as `consent_ip_address` so the consent receipt records the person, not this server's egress address
- `lib/talent-pool.ts`: cached form fetcher mirroring `lib/jobs.ts` (ISR 300s, `talent-pool` cache tag)
- Links to the talent pool from the job list heading and from the empty state
- `TALENT_POOL.md`: integration brief for adapting the flow into another codebase

### Changed

- Resume uploader moved to `components/file-upload.tsx` and its presign action to `lib/upload-actions.ts`, shared by both forms
- Shared submission-failure copy and API field-error shaping extracted to `lib/kit-errors.ts`; the rate-limit message now says "submissions" rather than "applications"
- `@startupkit-app/jobs` dependency raised to `^0.3.0` for `getTalentPool()` and `joinTalentPool()`

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
