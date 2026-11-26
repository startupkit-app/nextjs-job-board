import type { Metadata } from "next";
import Image from "next/image";
import { JobLink } from "@/components/job-link";
import { fetchPreviewIdentity, previewAssetPath } from "@/lib/preview-assets";
import { hasPreviewAccess, previewMode } from "@/lib/preview";
import "./globals.css";

const companyName = process.env.NEXT_PUBLIC_COMPANY_NAME || "Our company";

export const metadata: Metadata = previewMode ? {
  title: "Private careers preview",
  robots: { index: false, follow: false },
} : {
  title: {
    default: `Careers at ${companyName}`,
    template: `%s · ${companyName}`,
  },
  description: `Open roles at ${companyName}. Browse positions and apply online.`,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const signedIntoPreview = previewMode && await hasPreviewAccess();
  const displayName = !previewMode || signedIntoPreview ? companyName : "Kit";
  const identity = signedIntoPreview ? await fetchPreviewIdentity() : null;
  return (
    <html lang="en">
      <body className={`flex min-h-dvh flex-col ${identity?.font ? "preview-identity-font" : ""}`}>
        {identity?.font && (
          <style>{`@font-face{font-family:"Preview Brand";src:url("${previewAssetPath("font")}") format("woff2");font-display:swap}`}</style>
        )}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-indigo-600 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
        >
          Skip to content
        </a>

        <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
            <JobLink href="/" className="flex items-center gap-2.5">
              {identity?.logo ? (
                <Image unoptimized src={previewAssetPath("logo")} alt="" width={32} height={32} className="size-8 object-contain" />
              ) : (
                <span
                  aria-hidden="true"
                  className="flex size-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white"
                >
                  {displayName.charAt(0).toUpperCase()}
                </span>
              )}
              <span className="text-sm font-semibold tracking-tight">
                {displayName} <span className="font-normal text-zinc-500 dark:text-zinc-400">Careers</span>
              </span>
            </JobLink>
            <JobLink
              href="/"
              className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              {previewMode ? "Sample roles" : "Open roles"}
            </JobLink>
          </div>
        </header>

        {previewMode && (
          <div className="border-b border-indigo-100 bg-indigo-50 px-4 py-2 text-center text-sm font-medium text-indigo-900 dark:border-indigo-950 dark:bg-indigo-950 dark:text-indigo-100">
            Private demo · Applications are disabled
          </div>
        )}
        {identity?.background && (
          <div
            aria-hidden="true"
            className="h-28 bg-cover bg-center sm:h-40"
            style={{ backgroundImage: `url("${previewAssetPath("background")}")` }}
          />
        )}
        <main id="main" className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
          {children}
        </main>

        <footer className="border-t border-zinc-200 py-6 dark:border-zinc-800">
          <div className="mx-auto flex max-w-4xl items-center justify-between px-4 text-xs text-zinc-500 sm:px-6 dark:text-zinc-400">
            <p>
              © {new Date().getFullYear()} {displayName}
            </p>
            <p>
              Powered by{" "}
              <a
                href="https://startupkit.app"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-zinc-700 hover:text-indigo-600 dark:text-zinc-300 dark:hover:text-indigo-400"
              >
                Kit
              </a>
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
