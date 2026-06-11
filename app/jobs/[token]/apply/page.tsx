import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchJob } from "@/lib/jobs";
import { ApplyForm } from "./apply-form";

export const revalidate = 300;

type Params = Promise<{ token: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { token } = await params;
  const job = await fetchJob(token);
  if (!job) return { title: "Job not found", robots: { index: false } };
  return {
    title: `Apply — ${job.title}`,
    robots: { index: false }, // application forms shouldn't be indexed
  };
}

export default async function ApplyPage({ params }: { params: Params }) {
  const { token } = await params;
  const job = await fetchJob(token);
  if (!job) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href={`/jobs/${job.id}`}
        className="text-sm font-medium text-zinc-500 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400"
      >
        ← Back to job description
      </Link>

      <h1 className="mt-4 text-2xl font-bold tracking-tight">Apply for {job.title}</h1>
      <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-400">
        {[job.department, job.location].filter(Boolean).join(" · ")}
        {job.remote && " · Remote"}
      </p>

      <div className="mt-8">
        {job.accepting_applications ? (
          <ApplyForm token={job.id} jobTitle={job.title} form={job.application_form} />
        ) : (
          <div className="rounded-xl border border-zinc-200 bg-white px-6 py-10 text-center dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-base font-semibold">Applications are closed</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              This role is no longer accepting applications. Take a look at the other positions
              that are still open.
            </p>
            <Link
              href="/"
              className="mt-5 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
            >
              Browse open roles
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
