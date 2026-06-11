/**
 * Local, dependency-free shim for the `@startupkit-app/jobs` SDK.
 *
 * The real package is declared in package.json (`optionalDependencies`) but is
 * not published yet, so this file mirrors the SDK's EXACT public surface (same
 * type names, same method names, same `Page<T>` shape) against Kit's public
 * hiring API. Once `@startupkit-app/jobs` ships, swapping it in is a one-line change
 * in `lib/kit.ts` — replace `export * from "./kit-sdk-shim"` with
 * `export * from "@startupkit-app/jobs"`. Nothing else changes.
 *
 * API contract: https://startupkit.app/docs/public-jobs-api
 */

// ─── Wire types (mirror @startupkit-app/jobs) ─────────────────────────────────────

export interface Pagination {
  current_page: number;
  total_pages: number;
  total_count: number;
  per_page: number;
}

export interface Salary {
  // The API emits the salary block when EITHER bound is present, so either may be null.
  min: number | null;
  max: number | null;
  currency: string;
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
  published_at: string | null;
  url: string | null;
  salary?: Salary;
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

export interface Stage {
  name: string;
  type: string;
}

export interface ResumeRequirements {
  content_types: string[];
  max_byte_size: number;
}

export interface TurnstileConfig {
  required: boolean;
  sitekey: string | null;
}

export interface ApplicationForm {
  fields: FormField[];
  questions: Question[];
  consent_disclosure_html: string;
  resume: ResumeRequirements;
  turnstile: TurnstileConfig;
}

export interface JobDetail extends Job {
  description_html: string;
  accepting_applications: boolean;
  stages: Stage[];
  application_form: ApplicationForm;
}

export interface ListJobsParams {
  department?: string;
  location?: string;
  employment_type?: string;
  remote?: boolean;
  page?: number;
  per_page?: number;
}

export interface Page<T> {
  data: T[];
  pagination: Pagination;
  hasNextPage: boolean;
  /** Fetches the next page, or returns `null` on the last page. */
  nextPage(): Promise<Page<T>> | null;
}

export interface UploadMeta {
  filename: string;
  byte_size: number;
  /** Base64-encoded MD5 digest of the file's bytes. */
  checksum: string;
  content_type: string;
}

export interface UploadTicket {
  signed_id: string;
  filename: string;
  content_type: string;
  byte_size: number;
  direct_upload: {
    url: string;
    headers: Record<string, string>;
  };
}

export interface ApplicationInput {
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  /** Keyed by form field name / question key. */
  responses?: Record<string, string>;
  resume_signed_id?: string;
  /** File-type form fields: field name → direct-upload signed_id. */
  files?: Record<string, string>;
}

export interface ApplicationResult {
  id: string;
  status: "submitted";
  /** Public token of the job that was applied to. */
  job: string;
  submitted_at: string;
}

export interface ErrorEnvelope {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string[]>;
  };
}

// ─── Errors ───────────────────────────────────────────────────────────────────

export class KitApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly fields?: Record<string, string[]>;

  constructor(args: { status: number; code: string; message: string; fields?: Record<string, string[]> }) {
    super(args.message);
    this.name = "KitApiError";
    this.status = args.status;
    this.code = args.code;
    this.fields = args.fields;
  }
}

export class KitNetworkError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "KitNetworkError";
  }
}

// ─── Client ───────────────────────────────────────────────────────────────────

export interface RequestOptions {
  cache?: RequestCache;
  next?: { revalidate?: number | false; tags?: string[] };
  signal?: AbortSignal;
}

export interface ClientOptions {
  /** Publishable key (`pk_…`) — browser-safe. */
  publishableKey?: string;
  /** Secret key (`sk_…`) — server-side only. */
  secretKey?: string;
  /** Defaults to https://app.startupkit.app */
  baseUrl?: string;
}

export interface KitJobsClient {
  listJobs(params?: ListJobsParams, options?: RequestOptions): Promise<Page<Job>>;
  getJob(publicToken: string, options?: RequestOptions): Promise<JobDetail>;
  createUpload(meta: UploadMeta, options?: RequestOptions): Promise<UploadTicket>;
  apply(
    publicToken: string,
    input: ApplicationInput,
    opts?: { turnstileToken?: string }
  ): Promise<ApplicationResult>;
}

export const DEFAULT_BASE_URL = "https://app.startupkit.app";

interface RawPage {
  data: Job[];
  pagination: Pagination;
}

export function createClient(config: ClientOptions = {}): KitJobsClient {
  const apiKey = config.secretKey ?? config.publishableKey;
  const baseUrl = (config.baseUrl || DEFAULT_BASE_URL).replace(/\/+$/, "");

  async function request<T>(
    method: "GET" | "POST",
    path: string,
    init: {
      query?: Record<string, string | number | boolean | undefined>;
      body?: unknown;
      options?: RequestOptions;
    } = {}
  ): Promise<T> {
    if (!apiKey) {
      throw new Error(
        "Kit API key is missing. Set STARTUPKIT_SECRET_KEY (Kit → Hiring → Career Portal → Public API Keys)."
      );
    }

    const url = new URL(`${baseUrl}/api/public/v1${path}`);
    if (init.query) {
      for (const [key, value] of Object.entries(init.query)) {
        if (value !== undefined && value !== null && value !== "") {
          url.searchParams.set(key, String(value));
        }
      }
    }

    const fetchInit: RequestInit & { next?: RequestOptions["next"] } = {
      method,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
        ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      cache: init.options?.cache,
      next: init.options?.next,
      signal: init.options?.signal,
    };

    let response: Response;
    try {
      response = await fetch(url, fetchInit);
    } catch (cause) {
      throw new KitNetworkError(`Request to ${url} failed`, { cause });
    }
    if (!response.ok) throw await toApiError(response);
    return (await response.json()) as T;
  }

  function buildPage(raw: RawPage, params: ListJobsParams, options?: RequestOptions): Page<Job> {
    const { current_page, total_pages } = raw.pagination;
    const hasNextPage = current_page < total_pages;
    return {
      data: raw.data,
      pagination: raw.pagination,
      hasNextPage,
      nextPage: () => (hasNextPage ? listJobs({ ...params, page: current_page + 1 }, options) : null),
    };
  }

  async function listJobs(params: ListJobsParams = {}, options?: RequestOptions): Promise<Page<Job>> {
    const raw = await request<RawPage>("GET", "/jobs", { query: { ...params }, options });
    return buildPage(raw, params, options);
  }

  return {
    listJobs,

    getJob(publicToken, options) {
      return request<JobDetail>("GET", `/jobs/${encodeURIComponent(publicToken)}`, { options });
    },

    createUpload(meta, options) {
      return request<UploadTicket>("POST", "/direct_uploads", {
        body: { blob: meta },
        options: { cache: "no-store", ...options },
      });
    },

    apply(publicToken, input, opts) {
      return request<ApplicationResult>("POST", `/jobs/${encodeURIComponent(publicToken)}/applications`, {
        body: {
          application: input,
          ...(opts?.turnstileToken ? { turnstile_token: opts.turnstileToken } : {}),
        },
        options: { cache: "no-store" },
      });
    },
  };
}

async function toApiError(response: Response): Promise<KitApiError> {
  let code = "request_failed";
  let message = `Kit API request failed with status ${response.status}.`;
  let fields: Record<string, string[]> | undefined;

  try {
    const payload = (await response.json()) as Partial<ErrorEnvelope> | null;
    const error = payload?.error;
    if (error && typeof error === "object") {
      if (typeof error.code === "string") code = error.code;
      if (typeof error.message === "string") message = error.message;
      if (error.fields && typeof error.fields === "object") fields = error.fields;
    }
  } catch {
    // Non-JSON error body — keep the generic message.
  }

  return new KitApiError({ status: response.status, code, message, fields });
}
