import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Salary } from "@/components/salary";
import { formatDate, formatEmploymentType, humanize } from "@/lib/format";
import { jobPostingJsonLd, serializeJsonLd } from "@/lib/jsonld";
import { fetchJob } from "@/lib/jobs";
import { kit } from "@/lib/kit";

// ISR: pages regenerate at most every 5 minutes; the /api/revalidate webhook
// (tags "jobs" / "job-<token>") can bust them instantly.
export const revalidate = 300;
export const dynamicParams = true;

type Params = Promise<{ token: string }>;

export async function generateStaticParams() {
  try {
    const { data } = await kit.listJobs(
      { per_page: 100 },
      { next: { revalidate: 300, tags: ["jobs"] } }
    );
    return data.map((job) => ({ token: job.id }));
  } catch {
    // No API key at build time (e.g. a fresh fork) — render on demand instead.
    return [];
  }
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { token } = await params;
  const job = await fetchJob(token);
  // The loading.tsx streaming boundary commits a 200 before the API responds,
  // so a missing job can't change the HTTP status anymore. Returning an
  // explicit noindex keeps dead job URLs out of search engines (no soft-404s).
  if (!job) return { title: "Job not found", robots: { index: false } };

  const description = stripHtml(job.description_html).slice(0, 160);
  return {
    title: job.title,
    description,
    openGraph: { title: job.title, description, type: "website" },
  };
}

export default async function JobPage({ params }: { params: Params }) {
  const { token } = await params;
  const job = await fetchJob(token);
  if (!job) notFound();

  const employmentType = formatEmploymentType(job.employment_type);

  return (
    <article className="space-y-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jobPostingJsonLd(job)) }}
      />

      <div>
        <Link
          href="/"
          className="text-sm font-medium text-zinc-500 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400"
        >
          ← All open roles
        </Link>

        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{job.title}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
              {job.department && <Badge>{job.department}</Badge>}
              {job.location && <Badge>{job.location}</Badge>}
              {employmentType && <Badge>{employmentType}</Badge>}
              {job.remote && (
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  Remote
                </span>
              )}
            </div>
            <div className="mt-3 space-y-0.5 text-sm text-zinc-600 dark:text-zinc-400">
              <Salary salary={job.salary} className="font-medium text-zinc-900 dark:text-zinc-100" />
              <p>Posted {formatDate(job.published_at)}</p>
            </div>
          </div>

          <ApplyButton token={job.id} accepting={job.accepting_applications} />
        </div>
      </div>

      <div
        className="job-description"
        // Trusted content: rendered from your own Kit account's job description.
        dangerouslySetInnerHTML={{ __html: job.description_html }}
      />

      {job.stages.length > 0 && (
        <section aria-labelledby="hiring-process">
          <h2 id="hiring-process" className="text-lg font-semibold">
            Hiring process
          </h2>
          <ol className="mt-4 space-y-3">
            {job.stages.map((stage, index) => (
              <li key={`${stage.name}-${index}`} className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="flex size-7 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                >
                  {index + 1}
                </span>
                <div className="text-sm">
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">{stage.name}</span>
                  <span className="ml-2 text-zinc-500 dark:text-zinc-400">{humanize(stage.type)}</span>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      <div className="border-t border-zinc-200 pt-6 dark:border-zinc-800">
        <ApplyButton token={job.id} accepting={job.accepting_applications} />
      </div>
    </article>
  );
}

function ApplyButton({ token, accepting }: { token: string; accepting: boolean }) {
  if (!accepting) {
    return (
      <p className="inline-flex shrink-0 items-center rounded-lg bg-zinc-100 px-4 py-2.5 text-sm font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
        No longer accepting applications
      </p>
    );
  }
  return (
    <Link
      href={`/jobs/${token}/apply`}
      className="inline-flex shrink-0 items-center rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
    >
      Apply for this role
    </Link>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
      {children}
    </span>
  );
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
