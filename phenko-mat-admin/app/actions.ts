"use server";

import { and, eq, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { audit } from "@/lib/audit";
import { endAdminSession, requireAdmin, type Admin } from "@/lib/auth";
import { adminAuth } from "@/lib/firebase-admin";
import { deletePhotos, deleteUserPhotos, keyFromUrl } from "@/lib/r2";

/*
 * Every admin mutation. Server actions are reachable by direct POST, so each one checks the admin
 * session itself (requireAdmin), validates its input, records an audit entry and refreshes the pages
 * that show the changed data.
 */

export interface ActionState {
  ok?: string;
  error?: string;
}

const { items, reports, users, categories, itemCategories, userInterests } = schema;
const uuid = z.uuid();
const reason = z.string().trim().max(300).optional();

function fail(error: string): ActionState {
  return { error };
}

async function resolveReports(admin: Admin, where: ReturnType<typeof sql>, resolution: "actioned" | "dismissed") {
  await getDb()
    .update(reports)
    .set({ resolvedAt: new Date(), resolution, resolvedBy: admin.email })
    .where(and(isNull(reports.resolvedAt), where));
}

/* ---------- listings ---------- */

/**
 * Takes a listing down: it leaves every feed, its photos are deleted from storage, and its open reports
 * are marked as actioned. Chats about it stay, showing "no longer available" (same as an owner removing it).
 */
export async function removeListing(_: ActionState, form: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const id = uuid.safeParse(form.get("id"));
  const why = reason.safeParse(form.get("reason") ?? undefined);
  if (!id.success || !why.success) return fail("Invalid request.");

  const [removed] = await getDb()
    .update(items)
    .set({ status: "removed", updatedAt: new Date() })
    .where(and(eq(items.id, id.data), sql`${items.status} <> 'removed'`))
    .returning({ title: items.title, photos: items.photos, ownerId: items.ownerId });
  if (!removed) return fail("Listing not found or already removed.");

  // Keep any photo the owner still uses elsewhere (another live listing or their avatar).
  const inUse = await getDb().execute<{ url: string }>(sql`
    select unnest(photos) as url from items where owner_id = ${removed.ownerId} and status <> 'removed'
    union select avatar_url from users where id = ${removed.ownerId} and avatar_url is not null`);
  const keep = new Set(inUse.rows.map((r) => keyFromUrl(r.url)));
  await deletePhotos(removed.photos.filter((u) => !keep.has(keyFromUrl(u))));

  await resolveReports(admin, sql`${reports.itemId} = ${id.data}`, "actioned");
  await audit(admin, "listing.remove", { type: "listing", id: id.data }, `${removed.title}${why.data ? ` — ${why.data}` : ""}`);
  revalidatePath("/", "layout");
  return { ok: "Listing removed and its photos deleted." };
}

export async function dismissListingReports(_: ActionState, form: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const id = uuid.safeParse(form.get("id"));
  if (!id.success) return fail("Invalid request.");
  const [item] = await getDb().select({ title: items.title }).from(items).where(eq(items.id, id.data));
  await resolveReports(admin, sql`${reports.itemId} = ${id.data}`, "dismissed");
  await audit(admin, "reports.dismiss", { type: "listing", id: id.data }, item?.title);
  revalidatePath("/", "layout");
  return { ok: "Reports dismissed." };
}

/* ---------- users ---------- */

export async function dismissUserReports(_: ActionState, form: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const id = uuid.safeParse(form.get("id"));
  if (!id.success) return fail("Invalid request.");
  const [user] = await getDb().select({ name: users.name }).from(users).where(eq(users.id, id.data));
  await resolveReports(admin, sql`${reports.reportedUserId} = ${id.data} and ${reports.itemId} is null`, "dismissed");
  await audit(admin, "reports.dismiss", { type: "user", id: id.data }, user?.name);
  revalidatePath("/", "layout");
  return { ok: "Reports dismissed." };
}

/**
 * Suspends an account: the app refuses every request from it, its listings disappear from feeds and
 * profiles, and its Firebase account is disabled (signed out everywhere, can't sign back in).
 */
export async function suspendUser(_: ActionState, form: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const id = uuid.safeParse(form.get("id"));
  const why = z.string().trim().min(3, "Give a reason (at least 3 characters).").max(300).safeParse(form.get("reason"));
  if (!id.success) return fail("Invalid request.");
  if (!why.success) return fail(why.error.issues[0].message);

  const [user] = await getDb()
    .select({ name: users.name, email: users.email, firebaseUid: users.firebaseUid })
    .from(users)
    .where(eq(users.id, id.data));
  if (!user) return fail("User not found.");
  if (user.email && user.email.toLowerCase() === admin.email.toLowerCase()) return fail("You can't suspend your own account.");
  await getDb().update(users).set({ bannedAt: new Date(), banReason: why.data }).where(eq(users.id, id.data));

  await adminAuth()
    .updateUser(user.firebaseUid, { disabled: true })
    .then(() => adminAuth().revokeRefreshTokens(user.firebaseUid))
    .catch((e) => console.error("[admin] firebase disable failed", e));
  await resolveReports(admin, sql`${reports.reportedUserId} = ${id.data}`, "actioned");
  await audit(admin, "user.suspend", { type: "user", id: id.data }, `${user.name} — ${why.data}`);
  revalidatePath("/", "layout");
  return { ok: `${user.name} is suspended.` };
}

export async function unsuspendUser(_: ActionState, form: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const id = uuid.safeParse(form.get("id"));
  if (!id.success) return fail("Invalid request.");
  const [user] = await getDb()
    .update(users)
    .set({ bannedAt: null, banReason: null })
    .where(eq(users.id, id.data))
    .returning({ name: users.name, firebaseUid: users.firebaseUid });
  if (!user) return fail("User not found.");
  await adminAuth()
    .updateUser(user.firebaseUid, { disabled: false })
    .catch((e) => console.error("[admin] firebase enable failed", e));
  await audit(admin, "user.unsuspend", { type: "user", id: id.data }, user.name);
  revalidatePath("/", "layout");
  return { ok: `${user.name} can use the app again.` };
}

/** Permanently deletes an account: profile, listings, chats (cascade), photos, and the Firebase login. */
export async function deleteUser(_: ActionState, form: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const id = uuid.safeParse(form.get("id"));
  if (!id.success) return fail("Invalid request.");
  if (form.get("confirm") !== "DELETE") return fail('Type "DELETE" to confirm.');

  const [user] = await getDb()
    .select({ name: users.name, email: users.email, firebaseUid: users.firebaseUid })
    .from(users)
    .where(eq(users.id, id.data));
  if (!user) return fail("User not found.");
  if (user.email && user.email.toLowerCase() === admin.email.toLowerCase()) return fail("You can't delete your own account here.");

  await getDb().delete(users).where(eq(users.id, id.data));
  await deleteUserPhotos(id.data);
  await adminAuth()
    .deleteUser(user.firebaseUid)
    .catch((e) => console.error("[admin] firebase delete failed", e));
  await audit(admin, "user.delete", { type: "user", id: id.data }, `${user.name}${user.email ? ` <${user.email}>` : ""}`);
  revalidatePath("/", "layout");
  redirect("/users");
}

/* ---------- categories ---------- */

/** Built-in categories are re-created by the app's seed script, so only custom ones are editable. */
async function customCategory(id: string) {
  const [c] = await getDb().select().from(categories).where(eq(categories.id, id));
  return c && c.group === "custom" ? c : null;
}

export async function renameCategory(_: ActionState, form: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const id = z.string().min(1).max(48).safeParse(form.get("id"));
  const name = z.string().trim().min(2, "Name is too short.").max(40).safeParse(form.get("name"));
  const emoji = z.string().trim().min(1).max(16).safeParse(form.get("emoji"));
  if (!id.success) return fail("Invalid request.");
  if (!name.success) return fail(name.error.issues[0].message);
  if (!emoji.success) return fail("Pick an emoji.");
  const current = await customCategory(id.data);
  if (!current) return fail("Only custom categories can be edited.");
  try {
    await getDb().update(categories).set({ name: name.data, emoji: emoji.data }).where(eq(categories.id, id.data));
  } catch {
    return fail("Another category already has that name.");
  }
  await audit(admin, "category.rename", { type: "category", id: id.data }, `${current.name} → ${name.data}`);
  revalidatePath("/categories");
  return { ok: "Category updated." };
}

/**
 * Deletes a custom category. With "merge into", its listings and the people interested in it move to
 * that category first, so nothing ends up uncategorised.
 */
export async function deleteCategory(_: ActionState, form: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const id = z.string().min(1).max(48).safeParse(form.get("id"));
  const into = z.string().max(48).optional().safeParse((form.get("into") as string) || undefined);
  if (!id.success || !into.success) return fail("Invalid request.");
  const current = await customCategory(id.data);
  if (!current) return fail("Only custom categories can be deleted.");
  if (into.data === id.data) return fail("Pick a different category to merge into.");

  const db = getDb();
  if (into.data) {
    const [target] = await db.select({ id: categories.id }).from(categories).where(eq(categories.id, into.data));
    if (!target) return fail("That category doesn't exist.");
    await db.batch([
      db.execute(sql`insert into ${itemCategories} (item_id, category_id)
        select item_id, ${into.data} from ${itemCategories} where category_id = ${id.data} on conflict do nothing`),
      db.execute(sql`insert into ${userInterests} (user_id, category_id)
        select user_id, ${into.data} from ${userInterests} where category_id = ${id.data} on conflict do nothing`),
      db.delete(categories).where(eq(categories.id, id.data)),
    ]);
  } else {
    await db.delete(categories).where(eq(categories.id, id.data));
  }
  await audit(admin, "category.delete", { type: "category", id: id.data }, `${current.name}${into.data ? ` → merged into ${into.data}` : ""}`);
  revalidatePath("/categories");
  return { ok: into.data ? "Category merged and deleted." : "Category deleted." };
}

/* ---------- errors ---------- */

/** Deletes every recorded occurrence of one error (once it's fixed). New occurrences show up again. */
export async function clearErrorGroup(_: ActionState, form: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const fp = z.string().regex(/^[0-9a-f]{32}$/).safeParse(form.get("fingerprint"));
  if (!fp.success) return fail("Invalid request.");
  const deleted = await getDb()
    .delete(schema.errorEvents)
    .where(eq(schema.errorEvents.fingerprint, fp.data))
    .returning({ message: schema.errorEvents.message });
  await audit(admin, "errors.clear", { type: "error", id: fp.data }, `${deleted[0]?.message ?? ""} (${deleted.length} occurrences)`);
  revalidatePath("/errors");
  redirect("/errors");
}

/* ---------- session ---------- */

export async function signOut() {
  await endAdminSession();
  redirect("/login");
}
