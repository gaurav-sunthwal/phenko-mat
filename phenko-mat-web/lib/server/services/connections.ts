import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { ChatMessage, ConnectionSummary, SwipeResult, SwipeSummary } from "@/lib/dto";
import type { WireMessage } from "@/lib/realtime/protocol";
import { badRequest, gone, notFound } from "../errors";
import { isBlockedBetween } from "./safety";
import { publish } from "../realtime";

const { items, swipes, connections, messages } = schema;

type SummaryRow = {
  id: string;
  created_at: string;
  is_taker: boolean;
  item_id: string;
  item_title: string;
  item_photo: string;
  item_price: number;
  item_status: ConnectionSummary["item"]["status"];
  other_id: string;
  other_name: string;
  other_avatar: string | null;
  last_body: string | null;
  last_sender: string | null;
  last_at: string | null;
  unread: number;
  other_read_at: string;
};

function toSummary(userId: string, r: SummaryRow): ConnectionSummary {
  return {
    id: r.id,
    role: r.is_taker ? "taker" : "giver",
    item: {
      id: r.item_id,
      title: r.item_title,
      photo: r.item_photo,
      priceInr: Number(r.item_price),
      status: r.item_status,
    },
    other: { id: r.other_id, name: r.other_name, avatarUrl: r.other_avatar },
    lastMessage:
      r.last_body === null
        ? null
        : { body: r.last_body, mine: r.last_sender === userId, createdAt: new Date(r.last_at!).toISOString() },
    unread: Number(r.unread),
    otherReadAt: new Date(r.other_read_at).toISOString(),
    createdAt: new Date(r.created_at).toISOString(),
  };
}

/** Every summary query goes through here so the participant check can't be forgotten. */
async function querySummaries(userId: string, extra: ReturnType<typeof sql>, limit: number) {
  const result = await getDb().execute<SummaryRow>(sql`
    select c.id, c.created_at, (c.taker_id = ${userId}) as is_taker,
           -- Removed listings' photos are deleted from storage; clients show a placeholder for "".
           i.id as item_id, i.title as item_title,
           case when i.status = 'removed' then '' else i.photos[1] end as item_photo, i.price_inr as item_price,
           i.status as item_status,
           o.id as other_id, o.name as other_name, o.avatar_url as other_avatar,
           lm.body as last_body, lm.sender_id as last_sender, lm.created_at as last_at,
           (select count(*)::int from messages m
             where m.connection_id = c.id and m.sender_id <> ${userId}
               and m.created_at > case when c.taker_id = ${userId} then c.taker_read_at else c.giver_read_at end
           ) as unread,
           case when c.taker_id = ${userId} then c.giver_read_at else c.taker_read_at end as other_read_at
    from connections c
    join items i on i.id = c.item_id
    join users o on o.id = case when c.taker_id = ${userId} then c.giver_id else c.taker_id end
    left join lateral (
      select body, sender_id, created_at from messages
      where connection_id = c.id order by id desc limit 1
    ) lm on true
    where (c.taker_id = ${userId} or c.giver_id = ${userId}) ${extra}
    order by c.last_message_at desc
    limit ${limit}
  `);
  return result.rows.map((r) => toSummary(userId, r));
}

export function listConnections(userId: string) {
  return querySummaries(userId, sql``, 200);
}

export async function getConnection(userId: string, connectionId: string) {
  const [summary] = await querySummaries(userId, sql`and c.id = ${connectionId}`, 1);
  if (!summary) throw notFound("Chat");
  return summary;
}

// A connection's two parties never change, so membership is cached per instance. A deleted chat is evicted
// here; another instance may still hold it, but its writes then fail on the missing row (→ 404, see below).
const PARTIES_MAX = 20_000;
const partiesCache = new Map<string, { takerId: string; giverId: string }>();

async function loadParties(connectionId: string) {
  const hit = partiesCache.get(connectionId);
  if (hit) return hit;
  const [c] = await getDb()
    .select({ takerId: connections.takerId, giverId: connections.giverId })
    .from(connections)
    .where(eq(connections.id, connectionId));
  if (c) {
    if (partiesCache.size >= PARTIES_MAX) partiesCache.delete(partiesCache.keys().next().value!);
    partiesCache.set(connectionId, c);
  }
  return c;
}

/** Postgres foreign_key_violation, possibly wrapped by drizzle. */
function isMissingParent(e: unknown) {
  const code = (x: unknown) => (x as { code?: string } | null)?.code;
  return code(e) === "23503" || code((e as { cause?: unknown } | null)?.cause) === "23503";
}

/** Authorizes the caller as a participant; "not found" for everyone else so ids can't be probed. */
async function participants(userId: string, connectionId: string) {
  const c = await loadParties(connectionId);
  if (!c || (c.takerId !== userId && c.giverId !== userId)) throw notFound("Chat");
  const role = c.takerId === userId ? ("taker" as const) : ("giver" as const);
  return { role, otherId: role === "taker" ? c.giverId : c.takerId };
}

type MessageRow = typeof messages.$inferSelect;

function toWire(m: MessageRow): WireMessage {
  return {
    id: m.id,
    connectionId: m.connectionId,
    senderId: m.senderId,
    clientId: m.clientId,
    body: m.body,
    createdAt: m.createdAt.toISOString(),
  };
}

function toChatMessage(userId: string, m: MessageRow): ChatMessage {
  return {
    id: m.id,
    senderId: m.senderId,
    clientId: m.clientId,
    body: m.body,
    mine: m.senderId === userId,
    createdAt: m.createdAt.toISOString(),
  };
}

/* ---------- swipes ---------- */

export async function recordSwipe(userId: string, itemId: string, direction: "left" | "right"): Promise<SwipeResult> {
  const db = getDb();
  const [item] = await db
    .select({ ownerId: items.ownerId, status: items.status })
    .from(items)
    .where(eq(items.id, itemId));
  if (!item) throw notFound("Item");
  if (item.ownerId === userId) throw badRequest("That's your own item.");
  if (await isBlockedBetween(userId, item.ownerId)) throw notFound("Item");
  if (item.status !== "active") throw gone("Someone already got this one.");

  const swipe = db
    .insert(swipes)
    .values({ userId, itemId, direction })
    .onConflictDoUpdate({ target: [swipes.userId, swipes.itemId], set: { direction, createdAt: new Date() } });

  if (direction === "left") {
    await swipe;
    return { connection: null };
  }

  const [, inserted] = await db.batch([
    swipe,
    db
      .insert(connections)
      .values({ itemId, takerId: userId, giverId: item.ownerId })
      .onConflictDoNothing({ target: [connections.itemId, connections.takerId] })
      .returning({ id: connections.id }),
  ]);

  const [existing] = inserted.length
    ? inserted
    : await db
        .select({ id: connections.id })
        .from(connections)
        .where(and(eq(connections.itemId, itemId), eq(connections.takerId, userId)));
  // Let the giver know live that someone wants their item (only the first time).
  if (inserted.length) publish([item.ownerId], { type: "connection.new", connectionId: existing.id });
  return { connection: await getConnection(userId, existing.id) };
}

/** Lets people see items they passed on again (optionally only within one category). */
export async function resetPasses(userId: string, categoryId?: string) {
  await getDb().execute(sql`
    delete from swipes s
    where s.user_id = ${userId} and s.direction = 'left'
    ${categoryId ? sql`and exists (select 1 from item_categories ic where ic.item_id = s.item_id and ic.category_id = ${categoryId})` : sql``}
  `);
}

/**
 * Counts the user's swipes on items that are still listed, with the deck's filters, so an empty deck can say
 * why it's empty: passed items ("show them again" brings them back) vs. everything already said yes to.
 */
export async function swipeSummary(
  userId: string,
  opts: { categoryId?: string; freeOnly?: boolean },
): Promise<SwipeSummary> {
  const result = await getDb().execute<{ passed: number; wanted: number }>(sql`
    select count(*) filter (where s.direction = 'left')::int as passed,
           count(*) filter (where s.direction = 'right')::int as wanted
    from swipes s
    join items i on i.id = s.item_id
    where s.user_id = ${userId}
      and i.status = 'active'
      and i.owner_id <> ${userId}
      ${opts.freeOnly ? sql`and i.price_inr = 0` : sql``}
      ${opts.categoryId ? sql`and exists (select 1 from item_categories ic where ic.item_id = i.id and ic.category_id = ${opts.categoryId})` : sql``}
  `);
  const row = result.rows[0];
  return { passed: Number(row?.passed ?? 0), wanted: Number(row?.wanted ?? 0) };
}

/** Undo one pass (a mis-swipe). Only ever removes a "left" swipe; right swipes are connections. */
export async function undoPass(userId: string, itemId: string) {
  await getDb().execute(sql`
    delete from swipes where user_id = ${userId} and item_id = ${itemId} and direction = 'left'
  `);
}

/* ---------- messages ---------- */

const PAGE = 50;

export async function listMessages(
  userId: string,
  connectionId: string,
  { after, before }: { after?: number; before?: number } = {},
): Promise<ChatMessage[]> {
  await participants(userId, connectionId);
  const db = getDb();
  if (before !== undefined) {
    // Scrolling back: the page just before the oldest message on screen, returned oldest-first.
    const older = await db
      .select()
      .from(messages)
      .where(and(eq(messages.connectionId, connectionId), sql`${messages.id} < ${before}`))
      .orderBy(sql`${messages.id} desc`)
      .limit(PAGE);
    return older.reverse().map((m) => toChatMessage(userId, m));
  }
  const rows =
    after === undefined
      ? // Initial load: newest page, returned oldest-first.
        (
          await db
            .select()
            .from(messages)
            .where(eq(messages.connectionId, connectionId))
            .orderBy(sql`${messages.id} desc`)
            .limit(PAGE)
        ).reverse()
      : // Polling: only what's new since the cursor (index: connection_id, id).
        await db
          .select()
          .from(messages)
          .where(and(eq(messages.connectionId, connectionId), sql`${messages.id} > ${after}`))
          .orderBy(messages.id)
          .limit(PAGE);

  return rows.map((m) => toChatMessage(userId, m));
}

export async function sendMessage(
  userId: string,
  connectionId: string,
  body: string,
  clientId: string,
): Promise<ChatMessage> {
  const { role, otherId } = await participants(userId, connectionId);
  const db = getDb();
  // DB clock for all timestamps so unread comparisons never suffer from app-server clock skew.
  const now = sql`now()`;
  const [inserted] = await db
    .batch([
      db
        .insert(messages)
        .values({ connectionId, senderId: userId, body, clientId })
        .onConflictDoNothing({ target: [messages.senderId, messages.clientId] })
        .returning(),
      db
        .update(connections)
        .set(role === "taker" ? { lastMessageAt: now, takerReadAt: now } : { lastMessageAt: now, giverReadAt: now })
        .where(eq(connections.id, connectionId)),
    ])
    .catch((e: unknown) => {
      // The chat was deleted after this instance cached its parties.
      throw isMissingParent(e) ? notFound("Chat") : e;
    });

  if (inserted[0]) {
    // Both sides: the recipient, plus the sender's other open tabs/devices.
    publish([otherId, userId], { type: "message.new", message: toWire(inserted[0]) });
    return toChatMessage(userId, inserted[0]);
  }

  // Retry of a message we already stored: return the original, don't notify again.
  const [original] = await db
    .select()
    .from(messages)
    .where(and(eq(messages.senderId, userId), eq(messages.clientId, clientId)));
  if (!original || original.connectionId !== connectionId) throw badRequest("Duplicate message id.");
  return toChatMessage(userId, original);
}

export async function markRead(userId: string, connectionId: string) {
  const { role, otherId } = await participants(userId, connectionId);
  const now = sql`now()`;
  const [row] = await getDb()
    .update(connections)
    .set(role === "taker" ? { takerReadAt: now } : { giverReadAt: now })
    .where(eq(connections.id, connectionId))
    .returning({ takerReadAt: connections.takerReadAt, giverReadAt: connections.giverReadAt });
  if (!row) throw notFound("Chat");
  const readAt = (role === "taker" ? row.takerReadAt : row.giverReadAt).toISOString();
  publish([otherId, userId], { type: "connection.read", connectionId, readerId: userId, readAt });
}

/**
 * Deletes every chat between two people (blocking). Each side's open screens drop them live, and to
 * the blocked person it looks the same as the other person deleting the chat.
 */
export async function removeConnectionsBetween(userId: string, otherId: string) {
  const deleted = await getDb()
    .delete(connections)
    .where(
      sql`(${connections.takerId} = ${userId} and ${connections.giverId} = ${otherId})
          or (${connections.takerId} = ${otherId} and ${connections.giverId} = ${userId})`,
    )
    .returning({ id: connections.id });
  for (const { id } of deleted) {
    partiesCache.delete(id);
    publish([otherId, userId], { type: "connection.removed", connectionId: id, removedBy: userId });
  }
}

/**
 * Deletes a chat for both people (its messages go with it) and disconnects them live: each side's open
 * screens drop the chat straight away.
 *
 * What happens to the taker's right swipe depends on who ended it:
 * - The taker: it becomes a pass. The item leaves their feed for now and comes back with "Show passed items
 *   again", like anything else they passed on.
 * - The giver: it stays, so the item doesn't come back into the taker's feed for them to re-open a chat the
 *   giver chose to end.
 */
export async function removeConnection(userId: string, connectionId: string) {
  const { otherId } = await participants(userId, connectionId);
  const deleted = await getDb()
    .delete(connections)
    .where(and(eq(connections.id, connectionId), sql`${userId} in (${connections.takerId}, ${connections.giverId})`))
    .returning({ id: connections.id, itemId: connections.itemId, takerId: connections.takerId });
  partiesCache.delete(connectionId);
  // Already gone (the other person deleted it first): nothing to announce, and the caller got what they wanted.
  if (!deleted.length) return;
  const [{ itemId, takerId }] = deleted;
  if (takerId === userId) {
    await getDb()
      .update(swipes)
      .set({ direction: "left", createdAt: new Date() })
      .where(and(eq(swipes.userId, userId), eq(swipes.itemId, itemId), eq(swipes.direction, "right")));
  }
  publish([otherId, userId], { type: "connection.removed", connectionId, removedBy: userId });
}
