/** Shared display formatters. Safe in both Server and Client Components. */

const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  contract: "Contract",
  contractor: "Contract",
  temporary: "Temporary",
  internship: "Internship",
  intern: "Internship",
  per_diem: "Per diem",
};

export function humanize(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatEmploymentType(value: string | null | undefined): string | null {
  if (!value) return null;
  return EMPLOYMENT_TYPE_LABELS[value] ?? humanize(value);
}

const TALENT_POOL_FIELD_LABELS: Record<string, string> = {
  email: "Email",
  linkedin_url: "LinkedIn profile",
  resume: "Resume / CV",
  resume_signed_id: "Resume / CV",
};

/** Label for a talent-pool field — the API ships wire names, not display text. */
export function talentPoolFieldLabel(name: string): string {
  return TALENT_POOL_FIELD_LABELS[name] ?? humanize(name);
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(date);
}

/** Uses known currency minor units and falls back safely for configured custom codes. */
export function formatCurrencyAmount(amount: number, currency: string): string {
  const normalizedCurrency = currency.toUpperCase();

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: normalizedCurrency,
    }).format(amount);
  } catch {
    const formatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
    return `${formatter.format(amount)} ${normalizedCurrency}`;
  }
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${Math.round(bytes / 1024 ** 2)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}
