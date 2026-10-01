import "server-only";
import { eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";
import type { Me, PublicProfile } from "@/lib/dto";
import type { profileUpdateSchema } from "@/lib/validation";
import { badRequest, notFound } from "../errors";
import { notBlocked } from "./safety";
import { assertOwnUploads, deleteUserUploads, discardUploads } from "./uploads";

const { users, userInterests, categories } = schema;

export async function getMe(userId: string): Promise<Me> {
  const result = await getDb().execute<{
    id: string;
    name: string;
    email: string | null;
    bio: string;
    avatar_url: string | null;
    area: string | null;
    lat: number | null;
    lng: number | null;
    radius_km: number;
    interests: string[] | null;
    listed: number;
    given: number;
    got: number;
    connections: number;
  }>(sql`
    select u.id, u.name, u.email, u.bio, u.avatar_url, u.area, u.lat, u.lng, u.radius_km,
           (select array_agg(category_id) from user_interests where user_id = u.id) as interests,
           (select count(*)::int from items where owner_id = u.id and status <> 'removed') as listed,
           (select count(*)::int from items where owner_id = u.id and status = 'given') as given,
           (select count(*)::int from items where given_to_id = u.id) as got,
           (select count(*)::int from connections where taker_id = u.id or giver_id = u.id) as connections
    from users u where u.id = ${userId}
  `);
  const r = result.rows[0];
  if (!r) throw notFound("User");
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    bio: r.bio,
    avatarUrl: r.avatar_url,
    area: r.area,
    location: r.lat === null || r.lng === null ? null : { lat: r.lat, lng: r.lng },
    radiusKm: r.radius_km,
    interests: r.interests ?? [],
    stats: { listed: r.listed, given: r.given, got: r.got, connections: r.connections },
  };
}

export async function updateMe(userId: string, patch: z.infer<typeof profileUpdateSchema>) {
  const db = getDb();
  const { interests, location, ...fields } = patch;

  if (fields.avatarUrl) assertOwnUploads(userId, [fields.avatarUrl]);
  if (interests?.length) {
    const found = await db.select({ id: categories.id }).from(categories).where(inArray(categories.id, interests));
    if (found.length !== interests.length) throw badRequest("Unknown category in interests.");
  }

  const values = {
    ...fields,
    ...(location && { lat: location.lat, lng: location.lng, area: location.area }),
  };

  // Replaced (or cleared) avatar: remember the old one so it can be deleted once the change is saved.
  const oldAvatar =
    fields.avatarUrl !== undefined
      ? (await db.select({ url: users.avatarUrl }).from(users).where(eq(users.id, userId)))[0]?.url
      : null;

  const writes = [];
  if (Object.keys(values).length) writes.push(db.update(users).set(values).where(eq(users.id, userId)));
  if (interests) {
    writes.push(db.delete(userInterests).where(eq(userInterests.userId, userId)));
    if (interests.length) {
      writes.push(db.insert(userInterests).values(interests.map((categoryId) => ({ userId, categoryId }))));
    }
  }
  if (writes.length === 1) await writes[0];
  else if (writes.length > 1) await db.batch(writes as [(typeof writes)[number], ...(typeof writes)[number][]]);

  if (oldAvatar && oldAvatar !== fields.avatarUrl) await discardUploads(userId, [oldAvatar]);
  return getMe(userId);
}

/** Account deletion: cascades to items, swipes, connections and messages, then removes their photos. */
export async function deleteMe(userId: string) {
  await getDb().delete(users).where(eq(users.id, userId));
  // Best effort: if R2 is unreachable the daily photo cleanup removes them anyway (nothing references them now).
  await deleteUserUploads(userId).catch((error) => console.error("[uploads] account photo delete failed", error));
}

/** Someone else's profile. Blocked (either way) looks the same as not existing. */
export async function getPublicProfile(viewerId: string, userId: string): Promise<PublicProfile> {
  const result = await getDb().execute<{
    id: string;
    name: string;
    avatar_url: string | null;
    bio: string;
    area: string | null;
    created_at: string;
    given: number;
    got: number;
    listings: { id: string; title: string; photo: string; priceInr: number }[] | null;
  }>(sql`
    select u.id, u.name, u.avatar_url, u.bio, u.area, u.created_at,
           (select count(*)::int from items where owner_id = u.id and status = 'given') as given,
           (select count(*)::int from items where given_to_id = u.id) as got,
           (select json_agg(json_build_object('id', l.id, 'title', l.title, 'photo', l.photos[1], 'priceInr', l.price_inr)
                            order by l.created_at desc)
              from (select * from items where owner_id = u.id and status = 'active'
                    order by created_at desc limit 24) l) as listings
    from users u
    where u.id = ${userId} and (u.id = ${viewerId} or (${notBlocked(viewerId, sql`u.id`)} and u.banned_at is null))
  `);
  const r = result.rows[0];
  if (!r) throw notFound("User");
  return {
    id: r.id,
    name: r.name,
    avatarUrl: r.avatar_url,
    bio: r.bio,
    area: r.area,
    memberSince: new Date(r.created_at).toISOString(),
    stats: { given: r.given, got: r.got },
    listings: r.listings ?? [],
  };
}
