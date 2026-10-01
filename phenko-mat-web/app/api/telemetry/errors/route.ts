import type { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/server/auth";
import { clientIp, enforceRateLimit } from "@/lib/server/rate-limit";
import { recordError, routePattern } from "@/lib/server/telemetry";
import { clientErrorSchema } from "@/lib/validation";

const MAX_BYTES = 16 * 1024;

/**
 * Crash/error reports from the web and mobile apps. Deliberately open (no CSRF check, sign-in
 * optional): the app may crash before or during sign-in, and a report can't do harm beyond noise,
 * which the per-IP rate limit and per-fingerprint cap keep small.
 */
export async function POST(req: NextRequest) {
  try {
    await enforceRateLimit({ name: "telemetry:errors", limit: 60, windowSec: 600 }, clientIp(req));
  } catch {
    return Response.json({ ok: false }, { status: 429 });
  }
  const text = await req.text();
  if (text.length > MAX_BYTES) return Response.json({ ok: false }, { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }
  const parsed = clientErrorSchema.safeParse(body);
  if (!parsed.success) return Response.json({ ok: false }, { status: 400 });

  const user = await getSessionUser(req).catch(() => null);
  const { source, message, stack, route, meta } = parsed.data;
  recordError({
    source,
    message,
    stack,
    route: route ? routePattern(route) : null,
    userId: user?.id ?? null,
    meta: { ...meta, ua: req.headers.get("user-agent")?.slice(0, 200) },
  });
  return Response.json({ ok: true });
}
