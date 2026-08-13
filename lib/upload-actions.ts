"use server";

import { kit, KitApiError, type UploadMeta } from "./kit";
import { RATE_LIMITED_MESSAGE } from "./kit-errors";

export type PresignResult =
  | { ok: true; signedId: string; url: string; headers: Record<string, string> }
  | { ok: false; error: string };

/**
 * Presigns a direct upload via the Kit API (secret key, server-side). The
 * browser then PUTs the file straight to storage — bypassing Vercel's ~4.5 MB
 * request body limit — and submits the returned signed_id with the form.
 *
 * Shared by the job application form and the talent-pool signup form.
 */
export async function createFileUpload(meta: UploadMeta): Promise<PresignResult> {
  if (!meta?.filename || !meta.byte_size || !meta.checksum || !meta.content_type) {
    return { ok: false, error: "Incomplete file metadata." };
  }

  try {
    const { signed_id, direct_upload } = await kit.createUpload(meta);
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
