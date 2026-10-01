import { authedRoute, readJson } from "@/lib/server/api";
import { recordViews } from "@/lib/server/services/items";
import { viewsSchema } from "@/lib/validation";

/** Batched view pings from the swipe deck (feeds listing owners' analytics). */
export const POST = authedRoute(
  async ({ req, user }) => {
    await recordViews(user.id, await readJson(req, viewsSchema));
    return { ok: true };
  },
  { rateLimit: { name: "views", limit: 600, windowSec: 3600 } },
);
