import { timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

/**
 * Optional on-demand revalidation endpoint for Kit webhooks.
 *
 * Without it the site still stays fresh via ISR (job list: 60s, job detail:
 * 300s) — this endpoint just makes updates instant. Point a Kit webhook at:
 *
 *   POST https://your-site.example/api/revalidate
 *   Authorization: Bearer <REVALIDATE_SECRET>
 *
 * Relevant Kit webhook events:
 *   - job_posting.published   → a new role goes live (busts the "jobs" list)
 *   - application.submitted   → e.g. to refresh "accepting_applications" once
 *                               a role auto-closes at its application cap
 *
 * Body (best effort — any valid secret busts the "jobs" tag):
 *   { "event": "job_posting.published", "data": { "job": { "id": "<public_token>" } } }
 */
export async function POST(request: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Revalidation is disabled — REVALIDATE_SECRET is not configured." },
      { status: 503 }
    );
  }

  const authorization = request.headers.get("authorization") ?? "";
  const provided = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : (request.headers.get("x-revalidate-secret") ?? "");

  if (!safeEqual(provided, secret)) {
    return NextResponse.json({ error: "Invalid revalidation secret." }, { status: 401 });
  }

  let event: string | null = null;
  let jobToken: string | null = null;
  try {
    const body = (await request.json()) as {
      event?: string;
      data?: { job?: { id?: string }; id?: string };
    };
    event = body.event ?? null;
    jobToken = body.data?.job?.id ?? body.data?.id ?? null;
  } catch {
    // No/invalid JSON body — still revalidate the list.
  }

  const tags = ["jobs"];
  if (jobToken) tags.push(`job-${jobToken}`);
  for (const tag of tags) revalidateTag(tag, "max");

  return NextResponse.json({ revalidated: true, event, tags });
}

function safeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}
