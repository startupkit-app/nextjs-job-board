import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SetupNotice } from "@/components/setup-notice";
import { kitConfigured } from "@/lib/kit";
import { fetchTalentPool } from "@/lib/talent-pool";
import { SignupForm } from "./signup-form";

// Next evaluates segment config statically, so this must stay a literal — an
// imported constant fails the build. Keep it in step with TALENT_POOL_REVALIDATE.
export const revalidate = 300;

const companyName = process.env.NEXT_PUBLIC_COMPANY_NAME || "our company";

export async function generateMetadata(): Promise<Metadata> {
  if (!kitConfigured) return { title: "Talent pool", robots: { index: false } };

  const form = await fetchTalentPool();
  if (!form) return { title: "Talent pool", robots: { index: false } };

  return {
    title: "Talent pool",
    description: `Not the right role today? Share your details and we'll get in touch when something opens up at ${companyName}.`,
    // Unlike the apply form, this page is the whole point of a visit when
    // nothing is open — it should be findable. A closed pool has nothing to act
    // on, so only that state is hidden from search.
    robots: form.accepting_signups ? undefined : { index: false },
  };
}

export default async function TalentPoolPage() {
  if (!kitConfigured) return <SetupNotice />;

  const form = await fetchTalentPool();
  if (!form) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/"
        className="text-sm font-medium text-zinc-500 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400"
      >
        ← Back to open roles
      </Link>

      <h1 className="mt-4 text-2xl font-bold tracking-tight">Join our talent pool</h1>
      <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-400">
        No open role that fits? Leave your details and we&apos;ll reach out when one does.
      </p>

      <div className="mt-8">
        {form.accepting_signups ? (
          <>
            <SignupForm form={form} />
            <p className="mt-6 text-xs text-zinc-500 dark:text-zinc-400">
              We keep your details on file for {form.consent.retention_months}{" "}
              {form.consent.retention_months === 1 ? "month" : "months"}.
              {form.consent.privacy_policy_url && (
                <>
                  {" "}
                  Read our{" "}
                  <a
                    href={form.consent.privacy_policy_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium underline underline-offset-2 hover:text-indigo-600 dark:hover:text-indigo-400"
                  >
                    privacy policy
                  </a>
                  .
                </>
              )}
            </p>
          </>
        ) : (
          <div className="rounded-xl border border-zinc-200 bg-white px-6 py-10 text-center dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="text-base font-semibold">The talent pool is closed</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              We&apos;re not taking new talent-pool signups at the moment. Our open roles are still
              accepting applications.
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
