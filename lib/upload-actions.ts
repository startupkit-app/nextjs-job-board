"use server";

import { headers } from "next/headers";
import { clientIp } from "./client-ip";
import { describeContentTypes, formatBytes } from "./format";
import { fetchJob } from "./jobs";
import { kit, KitApiError, type UploadMeta } from "./kit";
import { RATE_LIMITED_MESSAGE } from "./kit-errors";
import { fetchTalentPool } from "./talent-pool";
import { createThrottle } from "./throttle";
import {
  constraintRefusal,
  jobUploadConstraints,
  metadataRefusal,
  type UploadConstraints,
  type UploadTarget,
} from "./upload-rules";

export type PresignResult =
  | { ok: true; signedId: string; url: string; headers: Record<string, string> }
  | { ok: false; error: string };

// Kit allows 30 presigns per IP per hour, and every visitor shares this server's IP.
const UPLOADS_PER_CLIENT_PER_HOUR = 10;
const throttle = createThrottle({ limit: UPLOADS_PER_CLIENT_PER_HOUR, windowMs: 60 * 60 * 1000 });

const THROTTLED_MESSAGE =
  "You've uploaded a lot of files in a short time. Please try again later — your answers will still be here.";
const NOT_ON_FORM_MESSAGE = "This file isn't part of the form you're filling in.";

/**
 * Presigns a direct upload via the Kit API (secret key, server-side). The
 * browser then PUTs the file straight to storage — bypassing Vercel's ~4.5 MB
 * request body limit — and submits the returned signed_id with the form.
 *
 * Shared by the job application form and the talent-pool signup form.
 */
export async function createFileUpload(target: UploadTarget, meta: UploadMeta): Promise<PresignResult> {
  const malformed = metadataRefusal(meta);
  if (malformed === "filename") {
    return { ok: false, error: "That file name can't be used. Rename the file and try again." };
  }
  if (malformed) return { ok: false, error: "Incomplete file metadata." };

  if (!throttle(clientIp(await headers()) ?? "unknown")) {
    return { ok: false, error: THROTTLED_MESSAGE };
  }

  try {
    const slot = await uploadSlot(target);
    if ("error" in slot) return { ok: false, error: slot.error };

    const refusal = constraintRefusal(meta, slot.constraints);
    if (refusal === "content_type") {
      return {
        ok: false,
        error: `That file type isn't accepted. Allowed: ${describeContentTypes(slot.constraints.content_types)}.`,
      };
    }
    if (refusal === "byte_size") {
      return { ok: false, error: `File is too large — the maximum is ${formatBytes(slot.constraints.max_byte_size)}.` };
    }

    const { filename, byte_size, checksum, content_type } = meta;
    const { signed_id, direct_upload } = await kit.createUpload({ filename, byte_size, checksum, content_type });
    return { ok: true, signedId: signed_id, url: direct_upload.url, headers: direct_upload.headers };
  } catch (error) {
    if (error instanceof KitApiError) {
      if (error.status === 429) {
        return { ok: false, error: RATE_LIMITED_MESSAGE };
      }
      return { ok: false, error: error.message };
    }
    console.error("Direct upload presign failed:", error);
    return { ok: false, error: "Couldn't prepare the upload. Please try again." };
  }
}

async function uploadSlot(target: UploadTarget): Promise<{ constraints: UploadConstraints } | { error: string }> {
  if (target?.kind === "talent_pool") {
    const form = await fetchTalentPool();
    if (!form) return { error: "This talent pool is no longer available." };
    if (!form.accepting_signups) return { error: "This talent pool isn't accepting new signups right now." };
    return { constraints: form.resume };
  }

  if (target?.kind !== "job" || typeof target.token !== "string" || typeof target.field !== "string") {
    return { error: NOT_ON_FORM_MESSAGE };
  }
  const job = await fetchJob(target.token);
  if (!job) return { error: "This job posting no longer exists." };
  if (!job.accepting_applications) return { error: "This role is no longer accepting applications." };
  const constraints = jobUploadConstraints(job.application_form, target.field);
  return constraints ? { constraints } : { error: NOT_ON_FORM_MESSAGE };
}
