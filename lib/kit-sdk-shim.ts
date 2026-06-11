/**
 * Local, dependency-free shim for the `@startupkit/jobs` SDK.
 *
 * The real package is declared in package.json (`optionalDependencies`) but is
 * not published yet, so this file implements the same public surface against
 * Kit's public hiring API (https://startupkit.app). Once `@startupkit/jobs`
 * ships, swap the import in `lib/kit.ts` — nothing else needs to change.
 *
 * API contract: https://startupkit.app/docs/public-jobs-api
 */

// ─── Resources ────────────────────────────────────────────────────────────────

export interface Salary {
  min: number;
  max: number;
  currency: string;
  /** e.g. "year" | "month" | "hour" */
  period: string;
}

export interface Job {
  /** Public token — stable, URL-safe identifier used in paths. */
  id: string;
  title: string;
  department: string | null;
  location: string | null;
  employment_type: string | null;
  remote: boolean;
  published_at: string;
  /** Canonical URL of the posting on the Kit-hosted career portal. */
  url: string;
  salary?: Salary | null;
}

export type FormFieldType =
  | "text"
  | "textarea"
  | "file"
  | "url"
  | "select"
  | "checkbox"
  | "email"
  | "phone";

export interface FormField {
  name: string;
  type: FormFieldType;
  label: string;
  required: boolean;
  placeholder?: string;
  options?: string[];
  max_length?: number;
}

export type QuestionType = "text" | "scenario" | "multiple_choice";

export interface Question {
  key: string;
  type: QuestionType;
  prompt: string;
  required: boolean;
  max_length: number;
  options?: string[];
}

export interface JobStage {
  name: string;
  type: string;
}

export interface ApplicationForm {
  fields: FormField[];
  questions: Question[];
  consent_disclosure_html: string | null;
  resume: {
    content_types: string[];
    max_byte_size: number;
  };
  turnstile: {
    required: boolean;
    sitekey: string | null;
  };
}

export interface JobDetail extends Job {
  description_html: string;
  accepting_applications: boolean;
  stages: JobStage[];
  application_form: ApplicationForm;
}

export interface Pagination {
  current_page: number;
  total_pages: number;
  total_count: number;
  per_page: number;
}

export interface JobsResponse {
  data: Job[];
  pagination: Pagination;
}

export interface ListJobsParams {
  department?: string;
  location?: string;
  employment_type?: string;
  remote?: boolean;
  page?: number;
  per_page?: number;
}

export interface DirectUploadMeta {
  filename: string;
  byte_size: number;
  /** Base64-encoded MD5 digest of the file contents. */
  checksum: string;
  content_type: string;
}

export interface DirectUploadResponse {
  signed_id: string;
  direct_upload: {
    url: string;
    headers: Record<string, string>;
  };
}

export interface ApplicationPayload {
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  /** Keyed by form field name / question key. */
  responses: Record<string, string>;
  resume_signed_id?: string;
  /** File-type form fields: field name → direct-upload signed_id. */
  files?: Record<string, string>;
}

export interface ApplicationResponse {
  id: string;
  status: "submitted";
  job: Job;
  submitted_at: string;
}

// ─── Errors ───────────────────────────────────────────────────────────────────

export type KitErrorCode =
  | "already_applied"
  | "validation_failed"
  | "turnstile_failed"
  // The API may introduce further codes; treat unknown codes generically.
  | (string & {});

export class KitApiError extends Error {
  readonly code: KitErrorCode;
  readonly status: number;
  readonly fields?: Record<string, string | string[]>;

  constructor(
    status: number,
    code: KitErrorCode,
    message: string,
    fields?: Record<string, string | string[]>
  ) {
    super(message);
    this.name = "KitApiError";
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

// ─── Client ───────────────────────────────────────────────────────────────────

/**
 * Per-request options forwarded to `fetch`. `next.revalidate` / `next.tags`
 * integrate with the Next.js data cache (ISR + on-demand revalidation).
 */
export interface RequestOptions {
  cache?: RequestCache;
  next?: { revalidate?: number | false; tags?: string[] };
  signal?: AbortSignal;
}

export interface KitClientConfig {
  /** Secret API key (sk_…). Server-side only — never ship it to the browser. */
  secretKey?: string;
  /** Defaults to https://app.startupkit.app */
  baseUrl?: string;
}

export interface KitClient {
  listJobs(params?: ListJobsParams, options?: RequestOptions): Promise<JobsResponse>;
  getJob(publicToken: string, options?: RequestOptions): Promise<JobDetail>;
  createDirectUpload(meta: DirectUploadMeta, options?: RequestOptions): Promise<DirectUploadResponse>;
  submitApplication(
    publicToken: string,
    application: ApplicationPayload,
    turnstileToken?: string,
    options?: RequestOptions
  ): Promise<ApplicationResponse>;
}

interface KitRequestInit extends RequestInit {
  next?: RequestOptions["next"];
}

const DEFAULT_BASE_URL = "https://app.startupkit.app";

export function createClient(config: KitClientConfig = {}): KitClient {
  const baseUrl = (config.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, "");

  function authorization(): string {
    if (!config.secretKey) {
      throw new Error(
        "Kit API key is missing. Set STARTUPKIT_SECRET_KEY (Kit → Hiring → Career Portal → Public API Keys)."
      );
    }
    return `Bearer ${config.secretKey}`;
  }

  async function request<T>(
    method: "GET" | "POST",
    path: string,
    {
      query,
      body,
      options,
    }: {
      query?: Record<string, string | number | boolean | undefined>;
      body?: unknown;
      options?: RequestOptions;
    } = {}
  ): Promise<T> {
    const url = new URL(`${baseUrl}/api/public/v1${path}`);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined && value !== null && value !== "") {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const init: KitRequestInit = {
      method,
      headers: {
        Authorization: authorization(),
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      cache: options?.cache,
      next: options?.next,
      signal: options?.signal,
    };

    const response = await fetch(url, init);
    if (!response.ok) throw await toApiError(response);
    return (await response.json()) as T;
  }

  return {
    listJobs(params = {}, options) {
      return request<JobsResponse>("GET", "/jobs", {
        query: {
          department: params.department,
          location: params.location,
          employment_type: params.employment_type,
          remote: params.remote,
          page: params.page,
          per_page: params.per_page,
        },
        options,
      });
    },

    getJob(publicToken, options) {
      return request<JobDetail>("GET", `/jobs/${encodeURIComponent(publicToken)}`, { options });
    },

    createDirectUpload(meta, options) {
      return request<DirectUploadResponse>("POST", "/direct_uploads", {
        body: { blob: meta },
        options: { cache: "no-store", ...options },
      });
    },

    submitApplication(publicToken, application, turnstileToken, options) {
      return request<ApplicationResponse>(
        "POST",
        `/jobs/${encodeURIComponent(publicToken)}/applications`,
        {
          body: {
            application,
            ...(turnstileToken ? { turnstile_token: turnstileToken } : {}),
          },
          options: { cache: "no-store", ...options },
        }
      );
    },
  };
}

async function toApiError(response: Response): Promise<KitApiError> {
  let code: KitErrorCode = "request_failed";
  let message = `Kit API request failed with status ${response.status}.`;
  let fields: Record<string, string | string[]> | undefined;

  try {
    const payload = (await response.json()) as {
      error?: { code?: string; message?: string; fields?: Record<string, string | string[]> };
    };
    if (payload?.error) {
      code = payload.error.code ?? code;
      message = payload.error.message ?? message;
      fields = payload.error.fields;
    }
  } catch {
    // Non-JSON error body — keep the generic message.
  }

  return new KitApiError(response.status, code, message, fields);
}
