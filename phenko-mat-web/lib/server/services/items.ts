import "server-only";
import { and, eq, inArray, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";
import type { FeedItem, ItemStats, LikedItem, MyItem } from "@/lib/dto";
import type { ItemCreateInput, itemUpdateSchema } from "@/lib/validation";
import { badRequest, conflict, notFound } from "../errors";
import { uuidv7 } from "../ids";
import { assertOwnUploads, discardUploads } from "./uploads";
import { notBlocked, notSuspended } from "./safety";
import { toFeedItem, type FeedRow } from "./feed";

const { items, itemCategories, categories, users } = schema;

/**
 * Distinct people who have seen an item: view pings plus anyone who swiped on it (a swipe means they saw
 * it, even if the ping never arrived — older app versions, offline).
 */
const viewerCount = (itemId: SQL) => sql`(select count(*)::int from (
  select user_id from item_views where item_id = ${itemId}
  union select user_id from swipes where item_id = ${itemId}
) seen)`;

async function assertCategoriesExist(ids: string[]) {
  const found = await getDb().select({ id: categories.id }).from(categories).where(inArray(categories.id, ids));
  if (found.length !== ids.length) throw badRequest("One or more categories don't exist.", "UNKNOWN_CATEGORY");
}

export async function createItem(userId: string, input: ItemCreateInput) {
  const db = getDb();
  assertOwnUploads(userId, input.photos);
  await assertCategoriesExist(input.categoryIds);

  // The spot the owner picked for this item, else where they said they live.
  let place = input.location;
  if (!place) {
    const [owner] = await db
      .select({ lat: users.lat, lng: users.lng, area: users.area })
      .from(users)
      .where(eq(users.id, userId));
    if (owner?.lat == null || owner.lng == null || !owner.area) {
      throw conflict("Set your location before listing an item.", "LOCATION_REQUIRED");
    }
    place = { lat: owner.lat, lng: owner.lng, area: owner.area };
  }

  const id = uuidv7();
  // Atomic: the item and its category links are written in one transaction.
  await db.batch([
    db.insert(items).values({
      id,
      ownerId: userId,
      title: input.title,
      description: input.description,
      photos: input.photos,
      condition: input.condition,
      priceInr: input.priceInr,
      area: place.area,
      lat: place.lat,
      lng: place.lng,
    }),
    db.insert(itemCategories).values(input.categoryIds.map((categoryId) => ({ itemId: id, categoryId }))),
  ]);
  return { id };
}

export async function updateItem(userId: string, itemId: string, patch: z.infer<typeof itemUpdateSchema>) {
  const db = getDb();
  const [existing] = await db
    .select({ ownerId: items.ownerId, status: items.status, photos: items.photos })
    .from(items)
    .where(eq(items.id, itemId));
  // Same response for "missing" and "not yours" so ids can't be probed.
  if (!existing || existing.ownerId !== userId || existing.status === "removed") throw notFound("Item");

  const { categoryIds, givenToId, location, ...rest } = patch;
  if (rest.photos) assertOwnUploads(userId, rest.photos);
  if (givenToId) await assertConnectedTaker(itemId, givenToId);
  // Relisting forgets who got it; marking as given records who did (or nobody).
  const fields = {
    ...rest,
    // `items.location` is generated from lat/lng, so a move writes those (and the area name others see).
    ...(location && { lat: location.lat, lng: location.lng, area: location.area }),
    ...(rest.status === "active" && { givenToId: null }),
    ...(rest.status === "given" && { givenToId: givenToId ?? null }),
  };
  if (categoryIds) await assertCategoriesExist(categoryIds);

  const ownerGuard = and(eq(items.id, itemId), eq(items.ownerId, userId));
  if (categoryIds) {
    await db.batch([
      db.update(items).set({ ...fields, updatedAt: new Date() }).where(ownerGuard),
      db.delete(itemCategories).where(eq(itemCategories.itemId, itemId)),
      db.insert(itemCategories).values(categoryIds.map((categoryId) => ({ itemId, categoryId }))),
    ]);
  } else {
    await db.update(items).set({ ...fields, updatedAt: new Date() }).where(ownerGuard);
  }
  // Photos taken out while editing aren't used anywhere else, so they go now.
  if (rest.photos) await discardUploads(userId, existing.photos.filter((url) => !rest.photos!.includes(url)));
  return { id: itemId };
}

/** Only someone who connected on the item can be recorded as its receiver. */
async function assertConnectedTaker(itemId: string, takerId: string) {
  const [found] = await getDb()
    .select({ id: schema.connections.id })
    .from(schema.connections)
    .where(and(eq(schema.connections.itemId, itemId), eq(schema.connections.takerId, takerId)));
  if (!found) throw badRequest("That person hasn't connected on this item.", "NOT_CONNECTED");
}

/**
 * Soft delete: the row stays so existing chats still show what they were about (title, price,
 * "no longer available"), but it leaves every feed and its photos are deleted from storage right away.
 * Chats show a placeholder instead of the photo from then on.
 */
export async function removeItem(userId: string, itemId: string) {
  const result = await getDb()
    .update(items)
    .set({ status: "removed", updatedAt: new Date() })
    .where(and(eq(items.id, itemId), eq(items.ownerId, userId), sql`${items.status} <> 'removed'`))
    .returning({ id: items.id, photos: items.photos });
  if (result.length === 0) throw notFound("Item");
  await discardUploads(userId, result[0].photos);
}

export async function getItem(userId: string, itemId: string): Promise<FeedItem> {
  const result = await getDb().execute<FeedRow>(sql`
    select i.id, i.title, i.description, i.photos, i.condition, i.price_inr, i.area, i.created_at, i.status,
           case when me.location is null then null
                else round((ST_Distance(i.location, me.location) / 1000.0)::numeric, 1)::float8 end as distance_km,
           u.id as owner_id, u.name as owner_name, u.avatar_url as owner_avatar,
           (select array_agg(category_id order by category_id) from item_categories where item_id = i.id) as category_ids,
           -- The exact pin goes to the owner only (to edit it); everyone else gets the area and distance.
           case when i.owner_id = ${userId} then i.lat end as pin_lat,
           case when i.owner_id = ${userId} then i.lng end as pin_lng
    from items i
    join users u on u.id = i.owner_id
    left join users me on me.id = ${userId}
    where i.id = ${itemId}
      and (i.status = 'active' or i.owner_id = ${userId}
           or exists (select 1 from connections c where c.item_id = i.id and c.taker_id = ${userId}))
      and i.status <> 'removed'
      and (i.owner_id = ${userId} or (${notBlocked(userId, sql`i.owner_id`)} and ${notSuspended(sql`i.owner_id`)}))
  `);
  const row = result.rows[0];
  if (!row) throw notFound("Item");
  return toFeedItem(row);
}

export async function listMyItems(userId: string): Promise<MyItem[]> {
  const result = await getDb().execute<{
    id: string;
    title: string;
    photos: string[];
    price_inr: number;
    status: MyItem["status"];
    created_at: string;
    category_ids: string[] | null;
    connection_count: number;
    view_count: number;
  }>(sql`
    select i.id, i.title, i.photos, i.price_inr, i.status, i.created_at,
           (select array_agg(category_id) from item_categories where item_id = i.id) as category_ids,
           (select count(*)::int from connections c where c.item_id = i.id) as connection_count,
           ${viewerCount(sql`i.id`)} as view_count
    from items i
    where i.owner_id = ${userId} and i.status <> 'removed'
    order by i.created_at desc
    limit 200
  `);
  return result.rows.map((r) => ({
    id: r.id,
    title: r.title,
    photos: r.photos,
    priceInr: Number(r.price_inr),
    status: r.status,
    categoryIds: r.category_ids ?? [],
    createdAt: new Date(r.created_at).toISOString(),
    connectionCount: Number(r.connection_count),
    viewCount: Number(r.view_count),
  }));
}

export async function listLikedItems(userId: string): Promise<LikedItem[]> {
  const result = await getDb().execute<{
    connection_id: string;
    item_id: string;
    title: string;
    photo: string;
    price_inr: number;
    status: LikedItem["item"]["status"];
    owner_id: string;
    owner_name: string;
    owner_avatar: string | null;
  }>(sql`
    select c.id as connection_id, i.id as item_id, i.title,
           case when i.status = 'removed' then '' else i.photos[1] end as photo, i.price_inr, i.status,
           u.id as owner_id, u.name as owner_name, u.avatar_url as owner_avatar
    from connections c
    join items i on i.id = c.item_id
    join users u on u.id = c.giver_id
    where c.taker_id = ${userId}
    order by c.created_at desc
    limit 200
  `);
  return result.rows.map((r) => ({
    connectionId: r.connection_id,
    item: { id: r.item_id, title: r.title, photo: r.photo, priceInr: Number(r.price_inr), status: r.status },
    owner: { id: r.owner_id, name: r.owner_name, avatarUrl: r.owner_avatar },
  }));
}

export async function reportItem(
  userId: string,
  itemId: string,
  input: { reason: "spam" | "scam" | "prohibited" | "offensive" | "other"; details?: string },
) {
  const db = getDb();
  const [item] = await db.select({ ownerId: items.ownerId }).from(items).where(eq(items.id, itemId));
  if (!item) throw notFound("Item");
  if (item.ownerId === userId) throw badRequest("You can't report your own item.");
  await db
    .insert(schema.reports)
    .values({ reporterId: userId, itemId, reportedUserId: item.ownerId, reason: input.reason, details: input.details })
    .onConflictDoNothing();
}

const idList = (ids: string[]) => sql.join(ids.map((id) => sql`${id}`), sql`, `);

/**
 * Records that the user saw these cards (and opened these details). Once per person per item; the
 * owner's own views and anything not live are ignored, so the numbers only count other people.
 */
export async function recordViews(userId: string, input: { seen: string[]; details: string[] }) {
  const db = getDb();
  const seen = [...new Set(input.seen)];
  const details = [...new Set(input.details)];
  const eligible = (ids: string[]) =>
    sql`from items i where i.id in (${idList(ids)}) and i.owner_id <> ${userId} and i.status = 'active'`;

  if (seen.length) {
    await db.execute(sql`
      insert into item_views (item_id, user_id)
      select i.id, ${userId} ${eligible(seen)}
      on conflict do nothing
    `);
  }
  if (details.length) {
    await db.execute(sql`
      insert into item_views (item_id, user_id, details_opened_at)
      select i.id, ${userId}, now() ${eligible(details)}
      on conflict (item_id, user_id)
        do update set details_opened_at = coalesce(item_views.details_opened_at, excluded.details_opened_at)
    `);
  }
}

/** Owner-only analytics for one listing. Reporters are never identified, only counted by reason. */
export async function getItemStats(userId: string, itemId: string): Promise<ItemStats> {
  const db = getDb();
  const [item] = await db
    .select({ ownerId: items.ownerId, status: items.status })
    .from(items)
    .where(eq(items.id, itemId));
  // Same response for "missing" and "not yours" so ids can't be probed.
  if (!item || item.ownerId !== userId || item.status === "removed") throw notFound("Item");

  const result = await db.execute<{
    views: number;
    detail_views: number;
    wanted: number;
    passed: number;
    chats: number;
    reports: Record<string, number> | null;
  }>(sql`
    select
      ${viewerCount(sql`${itemId}`)} as views,
      (select count(*)::int from item_views where item_id = ${itemId} and details_opened_at is not null) as detail_views,
      (select count(*)::int from swipes where item_id = ${itemId} and direction = 'right') as wanted,
      (select count(*)::int from swipes where item_id = ${itemId} and direction = 'left') as passed,
      (select count(*)::int from connections where item_id = ${itemId}) as chats,
      (select jsonb_object_agg(reason, n) from (
         select reason, count(*)::int as n from reports where item_id = ${itemId} group by reason
       ) r) as reports
  `);
  const r = result.rows[0];
  const byReason = r.reports ?? {};
  return {
    views: r.views,
    detailViews: r.detail_views,
    wanted: r.wanted,
    passed: r.passed,
    chats: r.chats,
    reports: { total: Object.values(byReason).reduce((a, b) => a + b, 0), byReason },
  };
}
