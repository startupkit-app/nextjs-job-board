"use client";

import { useId, useRef, useState } from "react";
import { formatBytes } from "@/lib/format";
import { md5Base64 } from "@/lib/md5";
import { createResumeUpload } from "./actions";

type UploadStatus = "empty" | "hashing" | "presigning" | "uploading" | "done" | "error";

/**
 * Direct-to-storage file upload:
 *
 *   1. Compute the base64 MD5 checksum in the browser (lib/md5.ts).
 *   2. Ask the `createResumeUpload` Server Action (secret key) to presign.
 *   3. PUT the file straight to storage from the browser — large resumes never
 *      pass through the Next.js server, avoiding Vercel's ~4.5 MB body limit.
 *   4. Mirror the signed_id into a hidden input the apply form submits.
 */
export function FileUpload({
  name,
  label,
  required = false,
  contentTypes,
  maxByteSize,
  serverError,
}: {
  /** Name of the hidden input, e.g. "resume_signed_id" or "file:portfolio". */
  name: string;
  label: string;
  required?: boolean;
  contentTypes?: string[];
  maxByteSize?: number;
  serverError?: string;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<UploadStatus>("empty");
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState<string | null>(null);
  const [signedId, setSignedId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const errorMessage = error ?? serverError;
  const busy = status === "hashing" || status === "presigning" || status === "uploading";

  async function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    setSignedId("");
    setProgress(0);
    setFileName(file.name);

    if (maxByteSize && file.size > maxByteSize) {
      fail(`File is too large — the maximum is ${formatBytes(maxByteSize)}.`);
      return;
    }
    const contentType = file.type || "application/octet-stream";
    if (contentTypes && contentTypes.length > 0 && !contentTypes.includes(contentType)) {
      fail(`That file type isn't accepted. Allowed: ${describeContentTypes(contentTypes)}.`);
      return;
    }

    try {
      setStatus("hashing");
      const checksum = md5Base64(await file.arrayBuffer());

      setStatus("presigning");
      const presign = await createResumeUpload({
        filename: file.name,
        byte_size: file.size,
        checksum,
        content_type: contentType,
      });
      if (!presign.ok) {
        fail(presign.error);
        return;
      }

      setStatus("uploading");
      await putWithProgress(presign.url, presign.headers, file, setProgress);

      setSignedId(presign.signedId);
      setStatus("done");
    } catch (uploadError) {
      console.error(uploadError);
      fail("Upload failed. Check your connection and try again.");
    }
  }

  function fail(message: string) {
    setError(message);
    setStatus("error");
    if (inputRef.current) inputRef.current.value = "";
  }

  function reset() {
    setStatus("empty");
    setSignedId("");
    setFileName(null);
    setError(null);
    setProgress(0);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div>
      <label htmlFor={inputId} className="block text-sm font-medium text-zinc-900 dark:text-zinc-100">
        {label}
        {required && (
          <span aria-hidden="true" className="ml-0.5 text-red-600 dark:text-red-400">
            *
          </span>
        )}
      </label>

      <div className="mt-1.5">
        {status === "done" ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 dark:border-emerald-800 dark:bg-emerald-950">
            <p className="truncate text-sm text-emerald-800 dark:text-emerald-200">
              <span aria-hidden="true">✓ </span>
              {fileName}
            </p>
            <button
              type="button"
              onClick={reset}
              className="shrink-0 text-sm font-medium text-emerald-700 underline underline-offset-2 hover:text-emerald-600 dark:text-emerald-300"
            >
              Replace
            </button>
          </div>
        ) : (
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept={contentTypes?.join(",")}
            onChange={handleChange}
            disabled={busy}
            aria-required={required}
            aria-invalid={errorMessage ? true : undefined}
            aria-describedby={`${inputId}-hint${errorMessage ? ` ${inputId}-error` : ""}`}
            className="block w-full cursor-pointer rounded-lg border border-zinc-300 bg-white text-sm text-zinc-600 file:mr-3 file:cursor-pointer file:rounded-l-lg file:border-0 file:bg-zinc-100 file:px-4 file:py-2.5 file:text-sm file:font-medium file:text-zinc-700 hover:file:bg-zinc-200 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:file:bg-zinc-800 dark:file:text-zinc-200"
          />
        )}
      </div>

      {busy && (
        <div className="mt-2" role="status" aria-live="polite">
          <div className="h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
            <div
              className="h-full rounded-full bg-indigo-600 transition-[width] duration-200"
              style={{ width: status === "uploading" ? `${progress}%` : "5%" }}
            />
          </div>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {status === "hashing" && "Preparing file…"}
            {status === "presigning" && "Requesting upload…"}
            {status === "uploading" && `Uploading… ${progress}%`}
          </p>
        </div>
      )}

      <p id={`${inputId}-hint`} className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
        {contentTypes && contentTypes.length > 0 && `${describeContentTypes(contentTypes)}. `}
        {maxByteSize && `Max ${formatBytes(maxByteSize)}.`}
      </p>

      {errorMessage && (
        <p id={`${inputId}-error`} role="alert" className="mt-1.5 text-sm text-red-600 dark:text-red-400">
          {errorMessage}
        </p>
      )}

      <input type="hidden" name={name} value={signedId} />
    </div>
  );
}

/** XHR (not fetch) so we can report upload progress. */
function putWithProgress(
  url: string,
  headers: Record<string, string>,
  file: File,
  onProgress: (percent: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    for (const [header, headerValue] of Object.entries(headers)) {
      xhr.setRequestHeader(header, headerValue);
    }
    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    });
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Storage responded with status ${xhr.status}`));
    });
    xhr.addEventListener("error", () => reject(new Error("Network error during upload")));
    xhr.addEventListener("abort", () => reject(new Error("Upload aborted")));
    xhr.send(file);
  });
}

function describeContentTypes(contentTypes: string[]): string {
  const names = contentTypes.map((type) => {
    const subtype = type.split("/")[1] ?? type;
    if (subtype.includes("wordprocessingml")) return "DOCX";
    if (subtype === "msword") return "DOC";
    return subtype.toUpperCase();
  });
  return Array.from(new Set(names)).join(", ");
}
