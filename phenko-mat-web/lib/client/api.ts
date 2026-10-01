"use client";

import type { ApiErrorBody } from "@/lib/dto";

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string[]>,
  ) {
    super(message);
  }
}

async function handle<T>(res: Response): Promise<T> {
  if (res.ok) return (await res.json()) as T;
  let body: ApiErrorBody | null = null;
  try {
    body = (await res.json()) as ApiErrorBody;
  } catch {
    // Non-JSON error (e.g. proxy timeout).
  }
  if (res.status === 401 && typeof window !== "undefined" && !location.pathname.startsWith("/login")) {
    // Expired/revoked session: clear the stale cookie so the proxy stops letting us through.
    await fetch("/api/auth/session", { method: "DELETE", credentials: "same-origin" }).catch(() => undefined);
    // Full reload on purpose: drops all cached SWR data from the old session. Recent searches live in
    // localStorage (not cleared by a reload) and belong to that account too.
    try {
      localStorage.removeItem("recent-searches");
    } catch {}
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = `/login?next=${encodeURIComponent(location.pathname + location.search)}`;
  }
  throw new ApiRequestError(
    res.status,
    body?.error.code ?? "HTTP_ERROR",
    body?.error.message ?? "Something went wrong. Please try again.",
    body?.error.fields,
  );
}

const TIMEOUT_MS = 20_000;

/**
 * fetch with a timeout and friendly errors (same as the app): a dead connection or hung server shows
 * "Check your connection" instead of a raw browser error or a spinner forever.
 */
async function send(url: string, init: RequestInit, timeoutMs = TIMEOUT_MS) {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (e) {
    const timedOut = e instanceof DOMException && e.name === "TimeoutError";
    throw new ApiRequestError(
      0,
      "NETWORK",
      timedOut ? "The request timed out. Check your connection." : "Network error. Check your connection.",
    );
  }
}

export const fetcher = <T>(url: string) =>
  send(url, { credentials: "same-origin", cache: "no-store" }).then((r) => handle<T>(r));

export function api<T = { ok: true }>(method: "POST" | "PATCH" | "DELETE", url: string, body?: unknown) {
  return send(url, {
    method,
    credentials: "same-origin",
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).then((r) => handle<T>(r));
}

const MAX_EDGE = 1280;
const QUALITY = 0.8;

const toBlob = (canvas: HTMLCanvasElement, type: string) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, QUALITY));

/**
 * Downscale + re-encode on the device first: faster uploads, smaller storage bill, and strips
 * EXIF (incl. GPS). WebP is ~30% smaller than JPEG; browsers that can't encode it (older Safari
 * silently returns PNG) fall back to JPEG.
 */
async function compress(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const webp = await toBlob(canvas, "image/webp");
  if (webp?.type === "image/webp") return webp;
  const jpeg = await toBlob(canvas, "image/jpeg");
  if (!jpeg) throw new Error("Could not process image");
  return jpeg;
}

export async function uploadImage(file: File): Promise<string> {
  const form = new FormData();
  const image = await compress(file);
  form.append("file", image, image.type === "image/webp" ? "photo.webp" : "photo.jpg");
  // Photos can take a while on slow connections: a longer timeout than other requests.
  const res = await send("/api/uploads", { method: "POST", body: form, credentials: "same-origin" }, 60_000);
  return (await handle<{ url: string }>(res)).url;
}
