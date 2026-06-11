import type { Salary as SalaryRange } from "@/lib/kit-sdk-shim";

const PERIOD_LABELS: Record<string, string> = {
  hour: "hr",
  hourly: "hr",
  day: "day",
  daily: "day",
  week: "wk",
  weekly: "wk",
  month: "mo",
  monthly: "mo",
  year: "yr",
  yearly: "yr",
  annual: "yr",
};

export function Salary({
  salary,
  className = "font-medium text-zinc-900 dark:text-zinc-100",
}: {
  salary: SalaryRange | null | undefined;
  className?: string;
}) {
  if (!salary) return null;

  const formatted = formatSalaryRange(salary);
  if (!formatted) return null;

  return <p className={className}>{formatted}</p>;
}

export function formatSalaryRange(salary: SalaryRange): string | null {
  let format: (value: number) => string;
  try {
    const formatter = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: salary.currency,
      notation: "compact",
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    });
    format = (value) => formatter.format(value);
  } catch {
    // Unknown currency code — fall back to a plain number with the raw code.
    const formatter = new Intl.NumberFormat("en-US", { notation: "compact" });
    format = (value) => `${formatter.format(value)} ${salary.currency}`;
  }

  const period = PERIOD_LABELS[salary.period] ?? salary.period;
  const range = salary.min === salary.max ? format(salary.min) : `${format(salary.min)} – ${format(salary.max)}`;
  return `${range} / ${period}`;
}
