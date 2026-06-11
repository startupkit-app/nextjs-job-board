import Link from "next/link";
import { Salary } from "@/components/salary";
import { formatDate, formatEmploymentType } from "@/lib/format";
import type { Job } from "@/lib/kit-sdk-shim";

export function JobCard({ job }: { job: Job }) {
  return (
    <Link
      href={`/jobs/${job.id}`}
      className="group block rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-indigo-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-indigo-700"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-zinc-900 group-hover:text-indigo-600 dark:text-zinc-100 dark:group-hover:text-indigo-400">
            {job.title}
          </h2>
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm text-zinc-600 dark:text-zinc-400">
            {job.department && <span>{job.department}</span>}
            {job.department && job.location && <span aria-hidden="true">·</span>}
            {job.location && <span>{job.location}</span>}
            {job.employment_type && (
              <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                {formatEmploymentType(job.employment_type)}
              </span>
            )}
            {job.remote && (
              <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                Remote
              </span>
            )}
          </div>
        </div>
        <div className="shrink-0 text-sm sm:text-right">
          <Salary salary={job.salary} />
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-500">
            Posted {formatDate(job.published_at)}
          </p>
        </div>
      </div>
    </Link>
  );
}
