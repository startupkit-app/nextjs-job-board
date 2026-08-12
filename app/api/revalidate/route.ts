import { createHmac, timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { jobTags } from "@/lib/jobs";

/**
 * On-demand revalidation endpoint for Kit webhooks.
 *
 * Without it the site still stays fresh via ISR (job list: 60s, job detail:
 * 300s) — this endpoint makes lifecycle changes take effect immediately.
 *
 * Configure a webhook in Kit (Integrations → Webhooks) pointing at:
 *
 *   POST https://your-site.example/api/revalidate
 *
 * and set KIT_WEBHOOK_SIGNING_SECRET to that endpoint's signing secret.
 *
 * Kit authenticates deliveries by signature, not by a shared bearer token: it
 * sends X-Webhook-Signature, X-Webhook-Timestamp and X-Webhook-Event, and has
 * no way to attach a custom Authorization header. Requests are therefore
 * verified by recomputing the HMAC below.
 *
 * Signature scheme (Kit side):
 *   HMAC-SHA256, key = the endpoint's signing secret, message = "<timestamp>.<body>",
 *   hex-encoded lowercase, sent bare in X-Webhook-Signature with no scheme prefix.
 *   X-Webhook-Timestamp is ISO 8601 (e.g. 2026-08-12T14:30:00Z), not a unix time.
 *
 * Kit does not enforce a replay window itself and documents it as the
 * consumer's responsibility, so this route rejects deliveries whose timestamp
 * is more than 5 minutes from now.
 */

/** Kit documents 5 minutes as the expected consumer-side replay tolerance. */
const TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000;

/**
 * Every job_posting event is a visibility transition: published/reopened make
 * a job appear on the public API, paused/closed make it 404. All four must
 * bust the job's own page as well as the list — a cached page for a paused
 * role would otherwise keep serving a position that is no longer open.
 *
 * Note Kit emits no job_posting.updated event, so plain content edits are not
 * covered here and still rely on the ISR window.
 */
const JOB_LIFECYCLE_EVENTS = new Set([
  "job_posting.published",
  "job_posting.reopened",
  "job_posting.paused",
  "job_posting.closed",
]);

type WebhookBody = {
  event?: string;
  data?: {
    /** The job's public token — the identifier the public API and this site use. */
    public_token?: string;
    /** Present on application.* events, which nest the job. */
    job_posting?: { public_token?: string };
  };
};

export async function POST(request: Request) {
  const secret = process.env.KIT_WEBHOOK_SIGNING_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Revalidation is disabled — KIT_WEBHOOK_SIGNING_SECRET is not configured." },
      { status: 503 }
    );
  }

  const signature = request.headers.get("x-webhook-signature") ?? "";
  const timestamp = request.headers.get("x-webhook-timestamp") ?? "";
  if (!signature || !timestamp) {
    return NextResponse.json({ error: "Missing webhook signature headers." }, { status: 401 });
  }

  // Kit signs the bytes it put on the wire. The payload is stored as jsonb, so
  // key order is normalised by Postgres and will not match the serializer's
  // declaration order — re-serialising a parsed object produces different bytes
  // and fails verification. The raw text is the only thing safe to verify.
  const rawBody = await request.text();

  const sentAt = Date.parse(timestamp);
  if (Number.isNaN(sentAt)) {
    return NextResponse.json({ error: "Invalid webhook timestamp." }, { status: 401 });
  }
  if (Math.abs(Date.now() - sentAt) > TIMESTAMP_TOLERANCE_MS) {
    return NextResponse.json({ error: "Webhook timestamp outside tolerance." }, { status: 401 });
  }

  // The timestamp is used exactly as received — reformatting it changes the
  // signed string and breaks verification.
  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  if (!safeEqual(signature, expected)) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
  }

  let body: WebhookBody = {};
  try {
    body = JSON.parse(rawBody) as WebhookBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const event = body.event ?? null;
  const jobToken = body.data?.public_token ?? body.data?.job_posting?.public_token ?? null;

  // Unrecognised events are acknowledged rather than rejected: a non-2xx would
  // make Kit retry a delivery that is not going to become relevant.
  let tags: string[] = [];
  if (event && JOB_LIFECYCLE_EVENTS.has(event)) {
    tags = jobToken ? jobTags(jobToken) : ["jobs"];
  } else if (event?.startsWith("application.") && jobToken) {
    // Application activity can change a role's accepting_applications state,
    // e.g. when it hits an application cap. Only that job needs refreshing.
    tags = [`job-${jobToken}`];
  }

  for (const tag of tags) revalidateTag(tag, "max");

  return NextResponse.json({ revalidated: tags.length > 0, event, tags });
}

function safeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}
