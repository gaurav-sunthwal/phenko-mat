import "server-only";
import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import { dbEnv } from "@/lib/server/env";
import * as schema from "./schema";

// Neon's HTTP driver: one round trip per query, no connection pool to exhaust on serverless.
// Multi-statement atomic writes use `db.batch([...])`, which runs as a single transaction.

let instance: NeonHttpDatabase<typeof schema> | undefined;

export function getDb() {
  instance ??= drizzle({ client: neon(dbEnv().DATABASE_URL), schema });
  return instance;
}

export { schema };
