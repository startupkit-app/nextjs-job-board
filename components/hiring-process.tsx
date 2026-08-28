import { formatCurrencyAmount, humanize } from "@/lib/format";
import type { Stage } from "@/lib/kit";

export function HiringProcess({ stages }: { stages: readonly Stage[] }) {
  const hasPaidStage = stages.some((stage) => stage.compensation);

  if (stages.length === 0) return null;

  return (
    <section aria-labelledby="hiring-process">
      <h2 id="hiring-process" className="text-lg font-semibold">
        Hiring process
      </h2>
      {hasPaidStage && (
        <p className="mt-1.5 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          Marked stages are eligible for a one-time payment, processed after you complete that
          step. This is separate from the role&apos;s salary.
        </p>
      )}

      <ol className="mt-5" aria-label="Hiring process steps">
        {stages.map((stage, index) => (
          <li
            key={`${stage.name}-${index}`}
            className="relative grid grid-cols-[2rem_minmax(0,1fr)] gap-x-3 pb-5 last:pb-0"
          >
            <div className="flex flex-col items-center" aria-hidden="true">
              <span className="relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-700 ring-4 ring-zinc-50 dark:bg-indigo-950 dark:text-indigo-300 dark:ring-zinc-950">
                {index + 1}
              </span>
              {index < stages.length - 1 && (
                <span className="-mb-5 mt-1 w-px grow bg-zinc-200 dark:bg-zinc-800" />
              )}
            </div>

            <div className="min-w-0 pt-1 sm:flex sm:items-start sm:justify-between sm:gap-4">
              <div className="min-w-0">
                <h3 className="text-sm font-medium leading-6 text-zinc-900 dark:text-zinc-100">
                  {stage.name}
                </h3>
                <p className="text-sm text-zinc-500 dark:text-zinc-400">{humanize(stage.type)}</p>
              </div>

              {stage.compensation && (
                <StagePayment
                  amount={stage.compensation.amount}
                  currency={stage.compensation.currency}
                />
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function StagePayment({ amount, currency }: { amount: number; currency: string }) {
  const formattedAmount = formatCurrencyAmount(amount, currency);

  return (
    <p className="mt-2 inline-flex max-w-full shrink-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-xs leading-4 text-indigo-800 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-200 sm:mt-0">
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        fill="currentColor"
        className="size-4 shrink-0"
      >
        <path
          fillRule="evenodd"
          d="M2.5 4.75A2.25 2.25 0 0 1 4.75 2.5h10.5a2.25 2.25 0 0 1 2.25 2.25v6.5a2.25 2.25 0 0 1-2.25 2.25H4.75a2.25 2.25 0 0 1-2.25-2.25v-6.5Zm3.75-.75a2.25 2.25 0 0 1-2.25 2.25v3.5A2.25 2.25 0 0 1 6.25 12h7.5A2.25 2.25 0 0 1 16 9.75v-3.5A2.25 2.25 0 0 1 13.75 4h-7.5ZM10 10.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z"
          clipRule="evenodd"
        />
        <path d="M5 15.25a.75.75 0 0 1 .75-.75h8.5a.75.75 0 0 1 0 1.5h-8.5a.75.75 0 0 1-.75-.75Zm2 2.25a.75.75 0 0 1 .75-.75h4.5a.75.75 0 0 1 0 1.5h-4.5A.75.75 0 0 1 7 17.5Z" />
      </svg>
      <span>Eligible for one-time payment</span>
      <strong className="font-semibold text-indigo-950 dark:text-indigo-100">
        {formattedAmount}
      </strong>
    </p>
  );
}
