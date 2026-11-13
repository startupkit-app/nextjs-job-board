# Job alerts

The job-board footer offers an email-only signup for all new public roles from this employer.
It does not inherit job-list filters. After submission, **Check your inbox** explains that
email confirmation is needed; only then do alerts start. Every alert includes unsubscribe.

The separate **Join the talent pool** invitation after signup opens the existing profile
form, with its own unchecked consent box. An alert request never creates a candidate,
submits a talent-pool entry, or forwards an email address in a URL.

## API and SDK dependency

This change requires `@startupkit-app/jobs` 0.8.0 and the matching Kit server release:

- `kit.getJobAlerts()` → `GET /api/public/v1/job_alert_subscriptions`
- `kit.createJobAlertSubscription({ email, locale }, { turnstileToken })` → POST to that path
- POST body: `{ job_alert_subscription: { email, locale? }, turnstile_token? }`
- Accepted response: `202 { status: "pending_confirmation" }`, identical for existing subscriptions

Discovery exposes availability, the privacy-policy link, Turnstile requirements and an
optional talent-pool invitation. A 404 hides the alert form while the job board keeps working.
The Server Action checks live requirements again, throttles requests per visitor, validates
email and locale, and uses the existing server-only SDK client. No new environment keys.
Failures retain the email, focus the relevant error and refresh a consumed Turnstile token.
The alert form uses the [compact Turnstile size](https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/widget-configurations/#widget-sizes)
to fit narrow phone layouts; existing forms keep their default size.

**Merge order:** merge/deploy Kit, merge/publish SDK 0.8.0, then refresh this template's npm
lockfile from the registry (`npm install`) and merge this PR. The pre-release lock entry has
no registry integrity because the release does not yet exist. Local verification uses the
packed SDK artifact; do not replace the final dependency with a filesystem path.

Browser regressions cover signup, locale/body boundaries, optional talent-pool consent,
validation recovery, and both root and `/careers` base paths with a fixture API.
