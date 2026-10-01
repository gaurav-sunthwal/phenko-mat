import { timingSafeEqual } from "node:crypto";
import { cronEnv } from "@/lib/server/env";
import { cleanupPhotos } from "@/lib/server/services/photo-cleanup";
import { pruneTelemetry, recordError } from "@/lib/server/telemetry";

/** Listing and deleting a large bucket can take a while. */
export const maxDuration = 300;

function authorized(req: Request) {
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${cronEnv().CRON_SECRET}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Daily photo cleanup, called by a scheduler with `Authorization: Bearer $CRON_SECRET`.
 * GET for Vercel Cron; POST for Cloud Scheduler, GitHub Actions or anything else.
 */
async function run(req: Request) {
  if (!authorized(req)) return Response.json({ error: { code: "UNAUTHORIZED" } }, { status: 401 });
  try {
    const dryRun = new URL(req.url).searchParams.get("dryRun") === "1";
    const result = await cleanupPhotos({ dryRun });
    // Same daily job: drop old error reports and request stats.
    const telemetry = dryRun ? null : await pruneTelemetry();
    console.log("[cron] photo cleanup", result, telemetry);
    return Response.json({ ...result, telemetry });
  } catch (error) {
    console.error("[cron] photo cleanup failed", error);
    recordError({
      source: "cron",
      route: "/api/cron/photo-cleanup",
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : null,
    });
    return Response.json({ error: { code: "CLEANUP_FAILED", message: String(error) } }, { status: 500 });
  }
}

export const GET = run;
export const POST = run;
