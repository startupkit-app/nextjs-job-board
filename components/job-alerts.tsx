"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { JobLink } from "@/components/job-link";
import { Turnstile } from "@/components/turnstile";
import { subscribeToJobAlerts, type JobAlertState } from "@/app/job-alerts/actions";
import type { JobAlertForm } from "@/lib/kit";

type FormState = JobAlertState & { attempt?: number };
const INITIAL: FormState = { status: "idle" };

export function JobAlerts({ form, locale, privacyUrl }: { form: JobAlertForm; locale?: string; privacyUrl?: string }) {
  const [state, action, pending] = useActionState(async (previous: FormState, data: FormData): Promise<FormState> => ({
    ...await subscribeToJobAlerts(previous, data), attempt: (previous.attempt ?? 0) + 1,
  }), INITIAL);
  const emailId = useId();
  const [email, setEmail] = useState("");
  const panel = useRef<HTMLElement>(null);

  useEffect(() => {
    if (state.status === "idle") return;
    const target = state.status === "success"
      ? panel.current?.querySelector<HTMLElement>("[data-confirmation]")
      : (panel.current?.querySelector<HTMLElement>('[aria-invalid="true"]') ?? panel.current?.querySelector<HTMLElement>('[role="alert"]'));
    target?.focus();
  }, [state]);

  return (
    <section ref={panel} aria-labelledby={`${emailId}-heading`} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5 sm:p-7 dark:border-zinc-800 dark:bg-zinc-900">
      {state.status === "success" ? (
        <div>
          <div role="status" data-confirmation tabIndex={-1} className="rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-600">
            <h2 id={`${emailId}-heading`} className="text-lg font-semibold">Check your inbox</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              If this address needs confirmation, we’ll send a link. Job alerts start after you confirm.
            </p>
          </div>
          {form.talent_pool_url && (
            <div className="mt-5 border-t border-zinc-200 pt-5 dark:border-zinc-700">
              <h3 className="text-sm font-semibold">Want the hiring team to consider you too?</h3>
              <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-400">Share your profile in the talent pool for future opportunities. This is a separate, optional step.</p>
              <JobLink href="/talent-pool" className="mt-3 inline-flex min-h-11 items-center rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:border-indigo-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:border-zinc-600">Join the talent pool →</JobLink>
            </div>
          )}
        </div>
      ) : (
        <form action={action} aria-busy={pending}>
          <h2 id={`${emailId}-heading`} className="text-lg font-semibold">Get new roles by email</h2>
          <p id={`${emailId}-description`} className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-400">Get an email when this team publishes a new role. All new roles, regardless of your current filters. Unsubscribe anytime.</p>
          {state.status === "error" && <p role="alert" tabIndex={-1} className="mt-3 text-sm text-red-700 dark:text-red-300">{state.message}</p>}
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <label htmlFor={emailId} className="block text-sm font-medium">Email address</label>
              <input id={emailId} name="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required maxLength={255} aria-invalid={state.status === "error" && state.emailError ? true : undefined} aria-describedby={`${emailId}-description`} className="mt-1.5 block min-h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 dark:border-zinc-600 dark:bg-zinc-950" />
            </div>
            <button type="submit" disabled={pending || (form.turnstile.required && !form.turnstile.sitekey)} className="min-h-11 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-60">{pending ? "Requesting…" : "Get job alerts"}</button>
          </div>
          {locale && <input type="hidden" name="locale" value={locale} />}
          {form.turnstile.required && !form.turnstile.sitekey && <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">Job alerts are temporarily unavailable. Please try again later.</p>}
          <p className="mt-3 text-xs leading-5 text-zinc-500 dark:text-zinc-400">By selecting Get job alerts, you ask to receive new-job emails. We&apos;ll ask you to confirm your address. Your details won&apos;t be added to the talent pool.{privacyUrl && <> <a href={privacyUrl} className="underline underline-offset-2">Privacy policy</a>.</>}</p>
          {form.turnstile.required && form.turnstile.sitekey && <Turnstile sitekey={form.turnstile.sitekey} size="compact" resetKey={state.attempt} quiet />}
        </form>
      )}
    </section>
  );
}
