import "server-only";
import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import type { Condition, FeedItem, ItemStatus } from "@/lib/dto";
import { notBlocked, notSuspended } from "./safety";
import { conflict } from "../errors";

/** Upper bound on items considered per request. Keeps ranking cost flat in dense cities. */
const CANDIDATE_POOL = 400;
/** How many recent swipes shape the "taste" signal. */
const TASTE_HISTORY = 300;
/** pg_trgm word similarity needed for a fuzzy match ("sofaa", "sofas" → "sofa"). */
const FUZZY_MATCH = 0.5;

export type FeedRow = {
  id: string;
  title: string;
  description: string;
  photos: string[];
  condition: Condition;
  price_inr: number;
  area: string;
  distance_km: number | null;
  category_ids: string[] | null;
  created_at: string;
  status: ItemStatus;
  owner_id: string;
  owner_name: string;
  owner_avatar: string | null;
  /** Only selected (and only non-null) for the item's owner. */
  pin_lat?: number | null;
  pin_lng?: number | null;
};

export function toFeedItem(r: FeedRow): FeedItem {
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    photos: r.photos,
    condition: r.condition,
    priceInr: Number(r.price_inr),
    area: r.area,
    distanceKm: r.distance_km === null ? null : Number(r.distance_km),
    categoryIds: r.category_ids ?? [],
    createdAt: new Date(r.created_at).toISOString(),
    status: r.status,
    owner: { id: r.owner_id, name: r.owner_name, avatarUrl: r.owner_avatar },
    ...(r.pin_lat != null && r.pin_lng != null && { location: { lat: Number(r.pin_lat), lng: Number(r.pin_lng) } }),
  };
}

export type FeedScope = "nearby" | "all";

/**
 * Items the user hasn't swiped on yet, ranked by taste, distance and freshness.
 *
 * scope "nearby": nearest-first KNN over the partial GiST index within the user's radius.
 * scope "all":    every active item, newest first, no location needed (distance shown if known).
 *
 * 1. `candidates`: capped at CANDIDATE_POOL so ranking cost stays flat.
 * 2. `affinity`: per-category weight from explicit interests (+2) and recent swipes
 *    (right +0.6, left -0.15).
 * 3. Final score = taste - 0.25 × km - 0.3 × days old (km term dropped when unknown).
 *
 * With `q` (search): only items whose title, description or category name match (substring or fuzzy),
 * ranked with a relevance boost. Items the user passed on come back, since searching says they're
 * looking again; ones they already wanted stay out.
 */
export async function getFeed(
  userId: string,
  opts: { categoryId?: string; limit: number; scope: FeedScope; q?: string },
): Promise<FeedItem[]> {
  const db = getDb();
  const nearby = opts.scope === "nearby";
  const categoryFilter = opts.categoryId
    ? sql`and exists (select 1 from item_categories f where f.item_id = i.id and f.category_id = ${opts.categoryId})`
    : sql``;
  const q = opts.q;
  // Escape LIKE wildcards so "100%" searches literally.
  const like = q && `%${q.replace(/[\\%_]/g, "\\$&")}%`;
  const searchFilter = q
    ? sql`and (i.title ilike ${like} or i.description ilike ${like}
               or word_similarity(${q}, i.title) >= ${FUZZY_MATCH}
               or exists (select 1 from item_categories sc join categories cn on cn.id = sc.category_id
                          where sc.item_id = i.id
                            and (cn.name ilike ${like} or word_similarity(${q}, cn.name) >= ${FUZZY_MATCH})))`
    : sql``;
  const swipedFilter = q ? sql`and s.direction = 'right'` : sql``;
  const relevance = q ? sql`+ word_similarity(${q}, c.title) * 3` : sql``;

  const result = await db.execute<FeedRow>(sql`
    with me as (
      select location, radius_km from users where id = ${userId}
    ),
    recent as (
      select item_id, direction from swipes
      where user_id = ${userId}
      order by created_at desc
      limit ${TASTE_HISTORY}
    ),
    affinity as (
      select category_id, sum(w)::float8 as w from (
        select category_id, 2.0 as w from user_interests where user_id = ${userId}
        union all
        select ic.category_id, case r.direction when 'right' then 0.6 else -0.15 end
        from recent r join item_categories ic on ic.item_id = r.item_id
      ) x
      group by category_id
    ),
    candidates as (
      select i.id, i.owner_id, i.title, i.description, i.photos, i.condition, i.price_inr, i.area,
             i.created_at, i.status,
             case when me.location is null then null
                  else ST_Distance(i.location, me.location) / 1000.0 end as distance_km
      from items i, me
      where i.status = 'active'
        and i.owner_id <> ${userId}
        and not exists (select 1 from swipes s where s.user_id = ${userId} and s.item_id = i.id ${swipedFilter})
        and ${notBlocked(userId, sql`i.owner_id`)}
        and ${notSuspended(sql`i.owner_id`)}
        ${nearby ? sql`and me.location is not null and ST_DWithin(i.location, me.location, me.radius_km * 1000)` : sql``}
        ${categoryFilter}
        ${searchFilter}
      order by ${nearby ? sql`i.location <-> me.location` : sql`i.created_at desc`}
      limit ${CANDIDATE_POOL}
    )
    select c.id, c.title, c.description, c.photos, c.condition, c.price_inr, c.area, c.created_at, c.status,
           round(c.distance_km::numeric, 1)::float8 as distance_km,
           u.id as owner_id, u.name as owner_name, u.avatar_url as owner_avatar,
           cats.ids as category_ids
    from candidates c
    join users u on u.id = c.owner_id
    cross join lateral (
      select array_agg(ic.category_id order by ic.category_id) as ids,
             coalesce(sum(a.w), 0) as taste
      from item_categories ic
      left join affinity a on a.category_id = ic.category_id
      where ic.item_id = c.id
    ) cats
    order by cats.taste ${relevance} - coalesce(c.distance_km, 0) * 0.25
             - extract(epoch from now() - c.created_at) / 86400.0 * 0.3 desc
    limit ${opts.limit}
  `);

  if (nearby && result.rows.length === 0) {
    const located = await db.execute(sql`select 1 from users where id = ${userId} and location is not null`);
    if (located.rows.length === 0) throw conflict("Set your location to see things nearby.", "LOCATION_REQUIRED");
  }
  return result.rows.map(toFeedItem);
}
