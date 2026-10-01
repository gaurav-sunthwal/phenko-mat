import "server-only";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { isBearerRequest, requireUser, type SessionUser } from "./auth";
import { ApiError, badRequest, forbidden } from "./errors";
import { appEnv } from "./env";
import { clientIp, enforceRateLimit, type RateLimit } from "./rate-limit";
import { recordError, recordRequest, routePattern } from "./telemetry";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const MAX_JSON_BYTES = 64 * 1024;

type Params = Record<string, string | string[] | undefined>;

interface HandlerContext<P extends Params> {
  req: NextRequest;
  params: P;
}

interface Options {
  rateLimit?: RateLimit;
}

/**
 * Blocks cross-site requests to state-changing endpoints. SameSite=Lax cookies already stop most
 * CSRF; checking Origin closes the remaining gaps (older browsers, same-site subdomains).
 */
function assertSameOrigin(req: NextRequest) {
  // Bearer-token requests (native apps) never use the cookie, and browsers can't attach an
  // Authorization header cross-site without a CORS preflight we don't allow — so no CSRF risk.
  if (isBearerRequest(req)) return;
  const origin = req.headers.get("origin");
  if (!origin) throw forbidden("Missing origin.", "CSRF");
  const allowed = appEnv().APP_ORIGIN ?? req.nextUrl.origin;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw forbidden("Bad origin.", "CSRF");
  }
  if (origin !== allowed && originHost !== host) throw forbidden("Cross-site request blocked.", "CSRF");
}

function toResponse(result: unknown) {
  if (result instanceof Response) return result;
  return Response.json(result ?? { ok: true }, { headers: { "Cache-Control": "private, no-store" } });
}

interface RequestInfo {
  req: NextRequest;
  userId?: string;
}

function errorResponse(error: unknown, info?: RequestInfo) {
  if (error instanceof ApiError) {
    return Response.json({ error: { code: error.code, message: error.message } }, { status: error.status });
  }
  if (error instanceof z.ZodError) {
    return Response.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: error.issues[0]?.message ?? "Invalid input.",
          fields: z.flattenError(error).fieldErrors,
        },
      },
      { status: 422 },
    );
  }
  // Never leak internals to the client; log for the server operator and the admin Errors page.
  console.error("[api] unhandled error", error);
  if (info) {
    recordError({
      source: "api",
      route: routePattern(info.req.nextUrl.pathname),
      method: info.req.method,
      status: 500,
      code: "INTERNAL",
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : null,
      userId: info.userId,
    });
  }
  return Response.json({ error: { code: "INTERNAL", message: "Something went wrong." } }, { status: 500 });
}

/** Route handler for anonymous endpoints (still CSRF-checked on writes). */
export function publicRoute<P extends Params = Params>(
  fn: (ctx: HandlerContext<P>) => Promise<unknown>,
  options: Options = {},
) {
  return async (req: NextRequest, ctx: { params: Promise<P> }) => {
    const started = performance.now();
    let res: Response;
    try {
      if (!SAFE_METHODS.has(req.method)) assertSameOrigin(req);
      if (options.rateLimit) await enforceRateLimit(options.rateLimit, clientIp(req));
      res = toResponse(await fn({ req, params: await ctx.params }));
    } catch (error) {
      res = errorResponse(error, { req });
    }
    recordRequest(`${req.method} ${routePattern(req.nextUrl.pathname)}`, res.status, performance.now() - started);
    return res;
  };
}

/** Route handler that requires a signed-in user. Rate limits are keyed per user. */
export function authedRoute<P extends Params = Params>(
  fn: (ctx: HandlerContext<P> & { user: SessionUser }) => Promise<unknown>,
  options: Options = {},
) {
  return async (req: NextRequest, ctx: { params: Promise<P> }) => {
    const started = performance.now();
    let userId: string | undefined;
    let res: Response;
    try {
      if (!SAFE_METHODS.has(req.method)) assertSameOrigin(req);
      const user = await requireUser(req);
      userId = user.id;
      if (options.rateLimit) await enforceRateLimit(options.rateLimit, user.id);
      res = toResponse(await fn({ req, user, params: await ctx.params }));
    } catch (error) {
      res = errorResponse(error, { req, userId });
    }
    recordRequest(`${req.method} ${routePattern(req.nextUrl.pathname)}`, res.status, performance.now() - started);
    return res;
  };
}

/** Parses and validates a JSON body with a size cap. */
export async function readJson<S extends z.ZodType>(req: NextRequest, schema: S): Promise<z.infer<S>> {
  if (!req.headers.get("content-type")?.includes("application/json")) {
    throw badRequest("Expected a JSON body.");
  }
  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > MAX_JSON_BYTES) throw badRequest("Request body too large.");
  const text = await req.text();
  if (text.length > MAX_JSON_BYTES) throw badRequest("Request body too large.");
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw badRequest("Malformed JSON.");
  }
  return schema.parse(data);
}

export function readQuery<S extends z.ZodType>(req: NextRequest, schema: S): z.infer<S> {
  return schema.parse(Object.fromEntries(req.nextUrl.searchParams));
}

export function readId(value: unknown, what = "id") {
  const parsed = z.uuid().safeParse(value);
  if (!parsed.success) throw badRequest(`Invalid ${what}.`);
  return parsed.data;
}
