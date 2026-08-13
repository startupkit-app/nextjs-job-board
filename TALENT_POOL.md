# Kit talent pool API — integration brief

Paste this file into your coding agent to add talent-pool signup to a site that already talks to
Kit's public hiring API.

Kit's public API captures talent-pool signups: people who want to be kept on file when no current
role fits. Two endpoints, same `pk_`/`sk_` keys as the jobs API.

- `GET /api/public/v1/talent_pool` — the intake contract: consent text, retention window, accepted
  CV types, whether Turnstile is required.
- `POST /api/public/v1/talent_pool/entries` — creates the entry. Kit emails a confirmation link;
  nobody enters the pool until they click it.

SDK (`@startupkit-app/jobs` >= 0.3.0): `kit.getTalentPool()` and
`kit.joinTalentPool({ email, consent, linkedin_url, resume_signed_id })`.

Three things to get right:

1. **Consent is a real checkbox, unchecked by default.** Render `consent.disclosure_html` as its
   label and send `consent: true` only when it was actually ticked. Kit answers `consent_required`
   otherwise — that refusal is deliberate, not a bug to work around.
2. **Submitting server-side, pass `consent_ip_address`** (first hop of `x-forwarded-for`). Without
   it every consent receipt names your server as the consenting party rather than the person.
   Ignored for `pk_` browser keys, which Kit observes directly.
3. **CVs use the existing presigned upload** — `createUpload` → `PUT` the bytes → pass the returned
   `signed_id` as `resume_signed_id`.

Reference implementation: [`app/talent-pool/`](app/talent-pool/) in this repo.
Full API docs: <https://startupkit.app/docs/public-jobs-api>
