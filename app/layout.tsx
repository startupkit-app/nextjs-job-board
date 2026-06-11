import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

const companyName = process.env.NEXT_PUBLIC_COMPANY_NAME || "Our company";

export const metadata: Metadata = {
  title: {
    default: `Careers at ${companyName}`,
    template: `%s · ${companyName}`,
  },
  description: `Open roles at ${companyName}. Browse positions and apply online.`,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-dvh flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-indigo-600 focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white"
        >
          Skip to content
        </a>

        <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4 sm:px-6">
            <Link href="/" className="flex items-center gap-2.5">
              <span
                aria-hidden="true"
                className="flex size-8 items-center justify-center rounded-lg bg-indigo-600 text-sm font-bold text-white"
              >
                {companyName.charAt(0).toUpperCase()}
              </span>
              <span className="text-sm font-semibold tracking-tight">
                {companyName} <span className="font-normal text-zinc-500 dark:text-zinc-400">Careers</span>
              </span>
            </Link>
            <Link
              href="/"
              className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              Open roles
            </Link>
          </div>
        </header>

        <main id="main" className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-6 sm:py-10">
          {children}
        </main>

        <footer className="border-t border-zinc-200 py-6 dark:border-zinc-800">
          <div className="mx-auto flex max-w-4xl items-center justify-between px-4 text-xs text-zinc-500 sm:px-6 dark:text-zinc-400">
            <p>
              © {new Date().getFullYear()} {companyName}
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
