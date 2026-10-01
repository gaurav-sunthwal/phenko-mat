import { env } from "@/config/env";
import type { ApiErrorBody } from "@/shared/dto";
import { ApiRequestError } from "./errors";

/*
 * One HTTP client for the whole app.
 * - Auth: `Authorization: Bearer <Firebase ID token>` (see phenko-mat-web/lib/server/auth.ts).
 * - A 401 is retried once with a force-refreshed token (clock skew, just-expired token) before
 *   the session is considered dead and `onUnauthorized` signs the user out.
 * - Every request has a timeout so a flaky network never leaves a spinner hanging.
 */

type Method = "GET" | "POST" | "PATCH" | "DELETE";

type TokenProvider = (forceRefresh: boolean) => Promise<string | null>;

let getToken: TokenProvider = async () => null;
let onUnauthorized: () => void = () => undefined;

/** The current bearer token if signed in (for best-effort calls like crash reports). Never throws. */
export async function currentToken() {
  return getToken(false).catch(() => null);
}

/** Wired up once by the auth module (avoids an import cycle). */
export function configureApiAuth(opts: { getToken: TokenProvider; onUnauthorized: () => void }) {
  getToken = opts.getToken;
  onUnauthorized = opts.onUnauthorized;
}

const DEFAULT_TIMEOUT_MS = 20_000;

export interface RequestOptions {
  body?: unknown;
  /** Multipart upload; mutually exclusive with `body`. */
  form?: FormData;
  signal?: AbortSignal;
  timeoutMs?: number;
  /** Override the bearer token (used right after sign-in, before the session is "ready"). */
  token?: string;
}

async function send(method: Method, path: string, opts: RequestOptions, token: string | null) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const abort = () => controller.abort();
  opts.signal?.addEventListener("abort", abort);

  const headers: Record<string, string> = { Accept: "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";

  try {
    return await fetch(`${env.apiUrl}${path}`, {
      method,
      headers,
      body: opts.form ?? (opts.body === undefined ? undefined : JSON.stringify(opts.body)),
      signal: controller.signal,
    });
  } catch (e) {
    if (opts.signal?.aborted) throw e; // caller cancelled (e.g. React Query) — let it propagate as-is
    throw new ApiRequestError(0, "NETWORK", controller.signal.aborted ? "The request timed out. Check your connection." : "Network error. Check your connection.");
  } finally {
    clearTimeout(timer);
    opts.signal?.removeEventListener("abort", abort);
  }
}

async function toError(res: Response) {
  let body: ApiErrorBody | null = null;
  try {
    body = (await res.json()) as ApiErrorBody;
  } catch {
    // Non-JSON error (proxy timeout, HTML error page).
  }
  return new ApiRequestError(
    res.status,
    body?.error?.code ?? "HTTP_ERROR",
    body?.error?.message ?? "Something went wrong. Please try again.",
    body?.error?.fields,
  );
}

export async function request<T = { ok: true }>(method: Method, path: string, opts: RequestOptions = {}): Promise<T> {
  let res = await send(method, path, opts, opts.token ?? (await getToken(false)));

  if (res.status === 401 && !opts.token) {
    const fresh = await getToken(true).catch(() => null);
    if (fresh) res = await send(method, path, opts, fresh);
    if (res.status === 401) onUnauthorized();
  }

  if (!res.ok) throw await toError(res);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string, signal?: AbortSignal) => request<T>("GET", path, { signal }),
  post: <T = { ok: true }>(path: string, body?: unknown) => request<T>("POST", path, { body }),
  patch: <T = { ok: true }>(path: string, body?: unknown) => request<T>("PATCH", path, { body }),
  delete: <T = { ok: true }>(path: string) => request<T>("DELETE", path),
};

/** `?a=1&b=2`, skipping undefined values. */
export function qs(params: Record<string, string | number | undefined | null>) {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "");
  if (!entries.length) return "";
  return `?${entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join("&")}`;
}
