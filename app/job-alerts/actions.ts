"use server";

import { headers } from "next/headers";
import { clientIp } from "@/lib/client-ip";
import { kit, KitApiError } from "@/lib/kit";
import { RATE_LIMITED_MESSAGE } from "@/lib/kit-errors";
import { createThrottle } from "@/lib/throttle";

const take = createThrottle({ limit: 5, windowMs: 60_000 });
const LOCALES = new Set(["en", "de", "fr", "es", "pl"]);

export type JobAlertState =
  | { status: "idle" }
  | { status: "success" }
  | { status: "error"; message: string; emailError?: string };

export async function subscribeToJobAlerts(
  _previous: JobAlertState,
  formData: FormData
): Promise<JobAlertState> {
  const value = (key: string) => {
    const raw = formData.get(key);
    return typeof raw === "string" ? raw.trim() : "";
  };
  const email = value("email");
  if (email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { status: "error", message: "Enter a valid email address.", emailError: "Enter a valid email address." };
  }
  if (!take(clientIp(await headers()) ?? "unknown")) {
    return { status: "error", message: RATE_LIMITED_MESSAGE };
  }

  try {
    // Recheck the live schema: a cached board must not bypass disabled alerts or Turnstile.
    const form = await kit.getJobAlerts({ cache: "no-store" });
    if (!form.accepting_subscriptions) {
      return { status: "error", message: "Job alerts are unavailable right now." };
    }
    const turnstileToken = value("turnstile_token");
    if (form.turnstile.required && !turnstileToken) {
      return { status: "error", message: "Complete the spam-protection check and try again." };
    }
    const locale = value("locale");
    await kit.createJobAlertSubscription(
      { email, locale: LOCALES.has(locale) ? locale : undefined },
      { turnstileToken: turnstileToken || undefined }
    );
    // Do not return the email or membership details to analytics, URLs or logs.
    return { status: "success" };
  } catch (error) {
    if (error instanceof KitApiError) {
      if (error.status === 429) return { status: "error", message: RATE_LIMITED_MESSAGE };
      if (error.status === 404) return { status: "error", message: "Job alerts are unavailable right now." };
      if (error.code === "turnstile_failed") {
        return { status: "error", message: "Complete the spam-protection check and try again." };
      }
      if (error.fields?.email) {
        return { status: "error", message: "Check your email address and try again.", emailError: "Enter a valid email address." };
      }
    }
    return { status: "error", message: "We couldn't request job alerts. Please try again." };
  }
}
