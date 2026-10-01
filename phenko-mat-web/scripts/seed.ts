/**
 * pnpm db:seed                    → upsert built-in categories (safe to run any time)
 * pnpm db:seed --demo [lat lng]   → also add demo neighbours + listings (default: central Pune)
 * pnpm db:seed --demo-logins      → make the demo neighbours real Firebase accounts you can sign in as
 * pnpm db:seed --clear-demo       → remove all demo users (DB + Firebase) and everything they own
 */
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import { applicationDefault, cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { like, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-http";
import { DEFAULT_CATEGORIES } from "../lib/catalog";
import * as schema from "../db/schema";
import { DEMO_ITEMS, DEMO_USERS } from "./demo-data";

try {
  process.loadEnvFile(".env.local");
} catch {}
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");

const db = drizzle({ client: neon(process.env.DATABASE_URL), schema });
const args = process.argv.slice(2);

const KM_PER_DEG = 111.32;
const offset = (lat: number, lng: number, dx: number, dy: number) => ({
  lat: lat + dy / KM_PER_DEG,
  lng: lng + dx / (KM_PER_DEG * Math.cos((lat * Math.PI) / 180)),
});

async function seedCategories() {
  await db
    .insert(schema.categories)
    .values(DEFAULT_CATEGORIES.map((c) => ({ ...c, blurb: c.blurb ?? null })))
    .onConflictDoUpdate({
      target: schema.categories.id,
      set: { name: sql`excluded.name`, emoji: sql`excluded.emoji`, group: sql`excluded.group`, blurb: sql`excluded.blurb` },
    });
  console.log(`✓ ${DEFAULT_CATEGORIES.length} categories`);
}

/* ---------- demo sign-in accounts ---------- */

const LOGINS_FILE = ".demo-logins.local";
const demoEmail = (key: string) => `${key}@demo.phenkomat.test`;

function firebaseAuth() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error("FIREBASE_PROJECT_ID is not set");
  const { FIREBASE_CLIENT_EMAIL: clientEmail, FIREBASE_PRIVATE_KEY: key } = process.env;
  const credential =
    clientEmail && key ? cert({ projectId, clientEmail, privateKey: key.replace(/\\n/g, "\n") }) : applicationDefault();
  return getAuth(initializeApp({ credential, projectId }, "seed"));
}

/** One shared password, generated once and kept in a gitignored file so reruns don't change it. */
function demoPassword() {
  if (existsSync(LOGINS_FILE)) {
    const match = readFileSync(LOGINS_FILE, "utf8").match(/^Password: (.+)$/m);
    if (match) return match[1].trim();
  }
  return `Demo-${randomBytes(6).toString("base64url")}`;
}

async function seedDemoLogins() {
  const auth = firebaseAuth();
  const password = demoPassword();
  const lines: string[] = [];
  for (const u of DEMO_USERS) {
    // Firebase uid === our users.firebase_uid, so signing in lands on the seeded profile + listings.
    const uid = `demo:${u.key}`;
    const props = { email: demoEmail(u.key), emailVerified: true, password, displayName: u.name, disabled: false };
    try {
      await auth.updateUser(uid, props);
    } catch (e) {
      if ((e as { code?: string }).code !== "auth/user-not-found") throw e;
      await auth.createUser({ uid, ...props });
    }
    lines.push(`${u.name.padEnd(16)} ${u.area.padEnd(14)} ${demoEmail(u.key)}`);
  }
  writeFileSync(
    LOGINS_FILE,
    `Phenko Mat demo accounts — for local testing only. Remove with: pnpm db:seed --clear-demo\n` +
      `Password: ${password}\n\n${lines.join("\n")}\n`,
    { mode: 0o600 },
  );
  console.log(`✓ ${DEMO_USERS.length} demo sign-in accounts (details in ${LOGINS_FILE})`);
}

async function deleteDemoLogins() {
  try {
    const result = await firebaseAuth().deleteUsers(DEMO_USERS.map((u) => `demo:${u.key}`));
    console.log(`✓ removed demo Firebase accounts (${result.successCount} checked)`);
  } catch (e) {
    console.warn("! could not remove demo Firebase accounts:", (e as Error).message.split("\n")[0]);
  }
}

async function clearDemo() {
  const removed = await db
    .delete(schema.users)
    .where(like(schema.users.firebaseUid, "demo:%"))
    .returning({ id: schema.users.id });
  console.log(`✓ removed ${removed.length} demo users (and their items/chats)`);
}

async function seedDemo(lat: number, lng: number) {
  await clearDemo();
  const users = await db
    .insert(schema.users)
    .values(
      DEMO_USERS.map((u) => ({
        // Only becomes a sign-in-able account after `--demo-logins`.
        firebaseUid: `demo:${u.key}`,
        name: u.name,
        bio: u.bio,
        area: u.area,
        ...offset(lat, lng, u.dx, u.dy),
      })),
    )
    .returning({ id: schema.users.id, firebaseUid: schema.users.firebaseUid });
  const idByKey = new Map(users.map((u) => [u.firebaseUid.slice(5), u.id]));
  const home = new Map(DEMO_USERS.map((u) => [u.key, u]));

  const now = Date.now();
  const items = await db
    .insert(schema.items)
    .values(
      DEMO_ITEMS.map((it) => {
        const owner = home.get(it.owner)!;
        const jitter = () => (Math.random() - 0.5) * 0.6;
        return {
          ownerId: idByKey.get(it.owner)!,
          title: it.title,
          description: it.description,
          photos: [`https://images.unsplash.com/${it.photo}?w=900&q=80&auto=format&fit=crop`],
          condition: it.condition,
          priceInr: it.priceInr,
          area: owner.area,
          ...offset(lat, lng, owner.dx + jitter(), owner.dy + jitter()),
          createdAt: new Date(now - it.hoursAgo * 3_600_000),
        };
      }),
    )
    .returning({ id: schema.items.id });

  await db
    .insert(schema.itemCategories)
    .values(DEMO_ITEMS.flatMap((it, i) => it.cats.map((categoryId) => ({ itemId: items[i].id, categoryId }))));
  console.log(`✓ ${users.length} demo neighbours, ${items.length} demo listings`);
}

async function main() {
  if (args.includes("--clear-demo")) {
    await clearDemo();
    await deleteDemoLogins();
    return;
  }
  await seedCategories();
  const demoAt = args.indexOf("--demo");
  if (demoAt >= 0) {
    const [latArg, lngArg] = args.slice(demoAt + 1, demoAt + 3).filter((a) => !a.startsWith("--"));
    const lat = Number(latArg ?? 18.5204);
    const lng = Number(lngArg ?? 73.8567);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error("Usage: --demo <lat> <lng>");
    await seedDemo(lat, lng);
  }
  if (args.includes("--demo-logins")) await seedDemoLogins();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
