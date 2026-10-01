import { authedRoute, readJson } from "@/lib/server/api";
import { createItem } from "@/lib/server/services/items";
import { itemCreateSchema } from "@/lib/validation";

export const POST = authedRoute(
  async ({ req, user }) => createItem(user.id, await readJson(req, itemCreateSchema)),
  { rateLimit: { name: "items:create", limit: 20, windowSec: 3600, store: "shared" } },
);
