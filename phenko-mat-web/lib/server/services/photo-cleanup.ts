import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { deleteUploads, listUploads, uploadKeyFromUrl } from "./uploads";

/** Given-away listings keep all photos this long; after that only the cover (history, old chats). */
const GIVEN_KEEP_DAYS = 90;
/** Never touch fresh uploads: the listing or profile that will use them may not be saved yet. */
const ORPHAN_GRACE_HOURS = 24;
/** Refuse to delete more than this share of the bucket in one run — a bad query shouldn't wipe it. */
const MAX_DELETE_SHARE = 0.5;

export interface PhotoCleanupResult {
  dryRun: boolean;
  trimmedListings: number;
  totalObjects: number;
  referencedObjects: number;
  deletedObjects: number;
  keptRecentOrphans: number;
}

/**
 * Daily storage cleanup (the safety net: removing a listing, editing photos out, replacing an avatar
 * and deleting an account already delete their photos straight away):
 * 1. Listings given away long ago are trimmed to their cover photo.
 * 2. Any uploaded object no user or live listing references (removed listings, abandoned publishes,
 *    or anything a failed immediate delete left behind) is deleted once it's older than the grace period.
 */
export async function cleanupPhotos({ dryRun = false, force = false } = {}): Promise<PhotoCleanupResult> {
  const db = getDb();

  const stale = sql`cardinality(photos) > 1 and status = 'given'
    and updated_at < now() - make_interval(days => ${GIVEN_KEEP_DAYS})`;
  const trimmed = dryRun
    ? await db.execute<{ id: string }>(sql`select id from items where ${stale}`)
    : await db.execute<{ id: string }>(sql`update items set photos = photos[1:1] where ${stale} returning id`);

  // Read references before listing the bucket: anything uploaded in between is inside the grace period.
  const refs = await db.execute<{ url: string }>(sql`
    select avatar_url as url from users where avatar_url is not null
    union
    select unnest(photos) as url from items where status <> 'removed'`);
  const referenced = new Set(refs.rows.map((r) => uploadKeyFromUrl(r.url)).filter((k): k is string => k !== null));

  const objects = await listUploads();
  const cutoff = Date.now() - ORPHAN_GRACE_HOURS * 60 * 60 * 1000;
  const orphans = objects.filter((o) => !referenced.has(o.key));
  const deletable = orphans.filter((o) => o.lastModified.getTime() < cutoff).map((o) => o.key);

  if (!force && deletable.length > 20 && deletable.length > objects.length * MAX_DELETE_SHARE) {
    throw new Error(
      `Refusing to delete ${deletable.length} of ${objects.length} photos (over ${MAX_DELETE_SHARE * 100}%). ` +
        "Check R2_PUBLIC_URL and the database, then rerun with force if this is really intended.",
    );
  }
  if (!dryRun) await deleteUploads(deletable);

  return {
    dryRun,
    trimmedListings: trimmed.rows.length,
    totalObjects: objects.length,
    referencedObjects: objects.length - orphans.length,
    deletedObjects: deletable.length,
    keptRecentOrphans: orphans.length - deletable.length,
  };
}
