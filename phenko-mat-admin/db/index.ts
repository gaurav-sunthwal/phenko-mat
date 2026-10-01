import "server-only";
import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";
import { env } from "@/lib/env";
import * as schema from "./schema";

let instance: NeonHttpDatabase<typeof schema> | undefined;

/** Same Neon database as the app. Multi-statement writes use `db.batch([...])` (one transaction). */
export function getDb() {
  instance ??= drizzle({ client: neon(env().DATABASE_URL), schema });
  return instance;
}

export { schema };
