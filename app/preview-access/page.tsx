import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { hasPreviewAccess, previewMode, signInToPreview } from "@/lib/preview";

export const metadata: Metadata = {
  title: "Private careers preview",
  robots: { index: false, follow: false },
};

export default async function PreviewAccess({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (!previewMode) notFound();
  if (await hasPreviewAccess()) redirect("/");
  const { error } = await searchParams;

  async function openPreview(data: FormData) {
    "use server";
    if (!(await signInToPreview(data.get("password")))) redirect("/preview-access?error=1");
    redirect("/");
  }

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
      <h1 className="text-2xl font-bold tracking-tight">Private careers preview</h1>
      <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
        Enter the password from your Kit contact to see the sample roles and candidate experience.
      </p>
      <form action={openPreview} className="mt-6 space-y-4">
        <div>
          <label htmlFor="preview-password" className="block text-sm font-semibold">Preview password</label>
          <input
            id="preview-password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            maxLength={256}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "preview-password-error" : undefined}
            className="mt-2 block w-full rounded-lg border border-zinc-400 px-3 py-2.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:border-zinc-500"
          />
          {error && (
            <p id="preview-password-error" role="alert" className="mt-2 text-sm text-red-700 dark:text-red-300">
              That password didn’t open the preview. Try again or contact the person who invited you.
            </p>
          )}
        </div>
        <button className="min-h-11 w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">
          Open preview
        </button>
      </form>
    </div>
  );
}
