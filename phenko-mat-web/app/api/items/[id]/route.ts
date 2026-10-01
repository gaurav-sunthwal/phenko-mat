import { authedRoute, readId, readJson } from "@/lib/server/api";
import { getItem, removeItem, updateItem } from "@/lib/server/services/items";
import { itemUpdateSchema } from "@/lib/validation";

type P = { id: string };

export const GET = authedRoute<P>(({ user, params }) => getItem(user.id, readId(params.id, "item id")));

export const PATCH = authedRoute<P>(
  async ({ req, user, params }) =>
    updateItem(user.id, readId(params.id, "item id"), await readJson(req, itemUpdateSchema)),
  { rateLimit: { name: "items:update", limit: 60, windowSec: 3600 } },
);

export const DELETE = authedRoute<P>(async ({ user, params }) => {
  await removeItem(user.id, readId(params.id, "item id"));
  return { ok: true };
});
