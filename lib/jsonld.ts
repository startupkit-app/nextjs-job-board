import type { JobDetail } from "./kit-sdk-shim";

/** Maps Kit employment_type values to schema.org employmentType enum members. */
const EMPLOYMENT_TYPES: Record<string, string> = {
  full_time: "FULL_TIME",
  part_time: "PART_TIME",
  contract: "CONTRACTOR",
  contractor: "CONTRACTOR",
  temporary: "TEMPORARY",
  internship: "INTERN",
  intern: "INTERN",
  volunteer: "VOLUNTEER",
  per_diem: "PER_DIEM",
  other: "OTHER",
};

/** Maps Kit salary periods to schema.org QuantitativeValue unitText values. */
const SALARY_UNITS: Record<string, string> = {
  hour: "HOUR",
  hourly: "HOUR",
  day: "DAY",
  daily: "DAY",
  week: "WEEK",
  weekly: "WEEK",
  month: "MONTH",
  monthly: "MONTH",
  year: "YEAR",
  yearly: "YEAR",
  annual: "YEAR",
};

/**
 * Builds a schema.org JobPosting object (Google for Jobs compatible) from a
 * job detail response.
 */
export function jobPostingJsonLd(job: JobDetail): Record<string, unknown> {
  const companyName = process.env.NEXT_PUBLIC_COMPANY_NAME;

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: job.description_html,
    datePosted: job.published_at,
    url: job.url,
    directApply: true,
  };

  if (companyName) {
    jsonLd.hiringOrganization = { "@type": "Organization", name: companyName };
  }

  if (job.employment_type) {
    jsonLd.employmentType = EMPLOYMENT_TYPES[job.employment_type] ?? job.employment_type.toUpperCase();
  }

  if (job.remote) {
    jsonLd.jobLocationType = "TELECOMMUTE";
  }

  if (job.location) {
    jsonLd.jobLocation = {
      "@type": "Place",
      address: { "@type": "PostalAddress", addressLocality: job.location },
    };
  }

  if (job.salary) {
    jsonLd.baseSalary = {
      "@type": "MonetaryAmount",
      currency: job.salary.currency,
      value: {
        "@type": "QuantitativeValue",
        minValue: job.salary.min,
        maxValue: job.salary.max,
        unitText: SALARY_UNITS[job.salary.period] ?? job.salary.period.toUpperCase(),
      },
    };
  }

  return jsonLd;
}

/**
 * Serializes JSON-LD for a <script type="application/ld+json"> tag, escaping
 * `<` to prevent the payload from breaking out of the script element.
 */
export function serializeJsonLd(data: Record<string, unknown>): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
