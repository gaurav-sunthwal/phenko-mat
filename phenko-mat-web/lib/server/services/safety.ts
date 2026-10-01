import "server-only";
import { and, eq, sql, type SQL } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { PublicUser } from "@/lib/dto";
import { badRequest, notFound } from "../errors";
import { removeConnectionsBetween } from "./connections";

const { blocks, reports, users } = schema;

/** SQL condition: no block in either direction between `userId` and the user in `otherColumn`. */
export function notBlocked(userId: string, otherColumn: SQL): SQL {
  return sql`not exists (
    select 1 from blocks b
    where (b.blocker_id = ${userId} and b.blocked_id = ${otherColumn})
       or (b.blocker_id = ${otherColumn} and b.blocked_id = ${userId}))`;
}

/** SQL condition: the user in `userColumn` isn't suspended (suspended people's listings are hidden). */
export function notSuspended(userColumn: SQL): SQL {
  return sql`not exists (select 1 from users su where su.id = ${userColumn} and su.banned_at is not null)`;
}

export async function isBlockedBetween(userId: string, otherId: string) {
  const result = await getDb().execute(sql`select 1 where not ${notBlocked(userId, sql`${otherId}::uuid`)}`);
  return result.rows.length > 0;
}

async function assertUserExists(id: string) {
  const [found] = await getDb().select({ id: users.id }).from(users).where(eq(users.id, id));
  if (!found) throw notFound("User");
}

/**
 * Blocks someone: their listings leave my feed (and mine theirs), every chat between us is deleted,
 * and neither of us can start a new one. Idempotent.
 */
export async function blockUser(userId: string, targetId: string) {
  if (targetId === userId) throw badRequest("You can't block yourself.");
  await assertUserExists(targetId);
  await getDb().insert(blocks).values({ blockerId: userId, blockedId: targetId }).onConflictDoNothing();
  await removeConnectionsBetween(userId, targetId);
}

export async function unblockUser(userId: string, targetId: string) {
  await getDb().delete(blocks).where(and(eq(blocks.blockerId, userId), eq(blocks.blockedId, targetId)));
}

/** People I've blocked, newest first (so I can unblock them). */
export async function listBlocked(userId: string): Promise<PublicUser[]> {
  const rows = await getDb()
    .select({ id: users.id, name: users.name, avatarUrl: users.avatarUrl })
    .from(blocks)
    .innerJoin(users, eq(users.id, blocks.blockedId))
    .where(eq(blocks.blockerId, userId))
    .orderBy(sql`${blocks.createdAt} desc`);
  return rows;
}

/** Reports a person (not a specific listing). Once per reporter; repeats are ignored. */
export async function reportUser(
  userId: string,
  targetId: string,
  input: { reason: "spam" | "scam" | "prohibited" | "offensive" | "other"; details?: string },
) {
  if (targetId === userId) throw badRequest("You can't report yourself.");
  await assertUserExists(targetId);
  await getDb()
    .insert(reports)
    .values({ reporterId: userId, reportedUserId: targetId, reason: input.reason, details: input.details })
    .onConflictDoNothing();
}
