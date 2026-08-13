// Shown instead of hitting the API when no key is configured. Every page that
// fetches at build time needs this guard: the SDK throws on a missing key, and
// a prerender turns that throw into a failed deploy rather than a bad page.
export function SetupNotice() {
  return (
    <div className="mx-auto max-w-xl rounded-xl border border-amber-300 bg-amber-50 p-6 dark:border-amber-700 dark:bg-amber-950">
      <h1 className="text-lg font-semibold text-amber-900 dark:text-amber-100">
        Almost there — connect your Kit account
      </h1>
      <p className="mt-2 text-sm leading-6 text-amber-800 dark:text-amber-200">
        This job board needs a Kit API key. Grab your secret key from{" "}
        <strong>Kit → Hiring → Career Portal → Public API Keys</strong>, then set it as the{" "}
        <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs dark:bg-amber-900">
          STARTUPKIT_SECRET_KEY
        </code>{" "}
        environment variable and restart (or redeploy) the app.
      </p>
      <p className="mt-3 text-sm text-amber-800 dark:text-amber-200">
        See the{" "}
        <a
          href="https://startupkit.app/docs/public-jobs-api"
          className="font-medium underline underline-offset-2"
          target="_blank"
          rel="noopener noreferrer"
        >
          Public Jobs API docs
        </a>{" "}
        for details.
      </p>
    </div>
  );
}
