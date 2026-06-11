import Link from "next/link";
import { Suspense } from "react";
import { EmptyState } from "@/components/empty-state";
import { JobCard } from "@/components/job-card";
import { JobFilters } from "@/components/job-filters";
import { kit, kitConfigured, type Job, type JobsResponse } from "@/lib/kit";

const PER_PAGE = 20;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function HomePage({ searchParams }: { searchParams: SearchParams }) {
  if (!kitConfigured) return <SetupNotice />;

  const sp = await searchParams;
  const param = (key: string): string | undefined => {
    const value = sp[key];
    return typeof value === "string" && value !== "" ? value : undefined;
  };

  const filters = {
    department: param("department"),
    location: param("location"),
    employment_type: param("employment_type"),
    remote: param("remote") === "true" ? true : undefined,
  };
  const page = Math.max(1, Number(param("page")) || 1);
  const hasFilters = Object.values(filters).some((value) => value !== undefined);

  // One filtered fetch for the list, one unfiltered fetch for facet options.
  // Both are cached for 60s and tagged "jobs" for on-demand revalidation.
  const [{ data: jobs, pagination }, facetSource] = await Promise.all([
    kit.listJobs(
      { ...filters, page, per_page: PER_PAGE },
      { next: { revalidate: 60, tags: ["jobs"] } }
    ),
    hasFilters || page > 1
      ? kit.listJobs({ per_page: 100 }, { next: { revalidate: 60, tags: ["jobs"] } })
      : undefined,
  ]);

  const facets = buildFacets((facetSource ?? { data: jobs }).data);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Open roles</h1>
        <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-400">
          {pagination.total_count === 0
            ? "No open positions right now."
            : `${pagination.total_count} open ${pagination.total_count === 1 ? "position" : "positions"}.`}
        </p>
      </div>

      <Suspense>
        <JobFilters
          departments={facets.departments}
          locations={facets.locations}
          employmentTypes={facets.employmentTypes}
        />
      </Suspense>

      {jobs.length === 0 ? (
        <EmptyState
          title={hasFilters ? "No matching roles" : "No open roles right now"}
          description={
            hasFilters
              ? "Try removing a filter or two — or check back soon."
              : "We're not hiring at the moment, but new roles open up regularly. Check back soon."
          }
          action={
            hasFilters ? (
              <Link
                href="/"
                className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
              >
                Clear all filters
              </Link>
            ) : undefined
          }
        />
      ) : (
        <ul className="space-y-3">
          {jobs.map((job) => (
            <li key={job.id}>
              <JobCard job={job} />
            </li>
          ))}
        </ul>
      )}

      <Pagination pagination={pagination} searchParams={sp} />
    </div>
  );
}

function buildFacets(jobs: Job[]) {
  const unique = (values: Array<string | null>) =>
    Array.from(new Set(values.filter((value): value is string => Boolean(value)))).sort();

  return {
    departments: unique(jobs.map((job) => job.department)),
    locations: unique(jobs.map((job) => job.location)),
    employmentTypes: unique(jobs.map((job) => job.employment_type)),
  };
}

function Pagination({
  pagination,
  searchParams,
}: {
  pagination: JobsResponse["pagination"];
  searchParams: Record<string, string | string[] | undefined>;
}) {
  if (pagination.total_pages <= 1) return null;

  const pageHref = (page: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (typeof value === "string" && value !== "" && key !== "page") params.set(key, value);
    }
    if (page > 1) params.set("page", String(page));
    const query = params.toString();
    return query ? `/?${query}` : "/";
  };

  const { current_page: current, total_pages: total } = pagination;
  const linkClass =
    "rounded-lg border border-zinc-200 bg-white px-3.5 py-2 text-sm font-medium text-zinc-700 hover:border-indigo-300 hover:text-indigo-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-indigo-600 dark:hover:text-indigo-400";

  return (
    <nav aria-label="Pagination" className="flex items-center justify-between pt-2">
      {current > 1 ? (
        <Link href={pageHref(current - 1)} className={linkClass}>
          ← Previous
        </Link>
      ) : (
        <span />
      )}
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Page {current} of {total}
      </p>
      {current < total ? (
        <Link href={pageHref(current + 1)} className={linkClass}>
          Next →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

function SetupNotice() {
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
