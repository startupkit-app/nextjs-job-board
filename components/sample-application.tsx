const sampleFields = [
  { label: "Full name", value: "Jordan Example" },
  { label: "Email", value: "jordan@example.test" },
  { label: "Portfolio", value: "https://portfolio.example" },
];

export function SampleApplication() {
  return (
    <section aria-labelledby="sample-application-heading" className="space-y-6 rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <div>
        <h2 id="sample-application-heading" className="text-lg font-semibold">Sample application</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
          See what a candidate would experience with example details. This preview sends no application.
        </p>
      </div>
      <dl className="grid gap-4">
        {sampleFields.map(({ label, value }) => (
          <div key={label}>
            <dt className="text-sm font-semibold">{label}</dt>
            <dd className="mt-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
              {value}
            </dd>
          </div>
        ))}
      </dl>
      <details className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700">
        <summary className="cursor-pointer py-1 text-sm font-semibold text-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:text-indigo-300">
          See sample confirmation
        </summary>
        <p className="mt-2 pb-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
          Thanks for applying. Your application is with the hiring team. We’ll email you about next steps.
        </p>
      </details>
    </section>
  );
}
