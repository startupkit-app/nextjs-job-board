import type { ApplicationForm, ResumeRequirements, UploadMeta } from "./kit";

export type UploadTarget = { kind: "job"; token: string; field: string } | { kind: "talent_pool" };

export type UploadConstraints = Pick<ResumeRequirements, "content_types" | "max_byte_size">;

export type UploadRefusal = "metadata" | "filename" | "content_type" | "byte_size";

/** Mirrors Kit's direct-upload ceiling: the schema publishes no limits for extra file fields. */
export const FORM_FILE_CONSTRAINTS: UploadConstraints = {
  content_types: [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "image/png",
    "image/jpeg",
    "image/gif",
    "image/webp",
  ],
  max_byte_size: 25 * 1024 * 1024,
};

export const RESUME_FIELD = "resume";

const MAX_FILENAME_LENGTH = 255;
const BASE64_MD5 = /^[A-Za-z0-9+/]{22}==$/;
const UNSAFE_FILENAME = /[\u0000-\u001f\u007f/\\]/;

export function jobUploadConstraints(form: ApplicationForm, field: string): UploadConstraints | null {
  if (field === RESUME_FIELD) return form.resume;
  const fileField = form.fields.some((candidate) => candidate.name === field && candidate.type === "file");
  return fileField ? FORM_FILE_CONSTRAINTS : null;
}

export function metadataRefusal(meta: unknown): UploadRefusal | undefined {
  const { filename, byte_size, checksum, content_type } = (meta ?? {}) as Partial<Record<keyof UploadMeta, unknown>>;

  if (
    typeof filename !== "string" ||
    typeof content_type !== "string" ||
    !content_type ||
    typeof checksum !== "string" ||
    !BASE64_MD5.test(checksum) ||
    !Number.isSafeInteger(byte_size) ||
    (byte_size as number) <= 0
  ) {
    return "metadata";
  }
  if (!filename.trim() || filename.length > MAX_FILENAME_LENGTH || UNSAFE_FILENAME.test(filename)) {
    return "filename";
  }
  return undefined;
}

export function constraintRefusal(meta: UploadMeta, constraints: UploadConstraints): UploadRefusal | undefined {
  if (!constraints.content_types.includes(meta.content_type)) return "content_type";
  if (meta.byte_size > constraints.max_byte_size) return "byte_size";
  return undefined;
}
