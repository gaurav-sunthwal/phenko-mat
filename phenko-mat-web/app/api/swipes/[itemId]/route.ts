import { authedRoute, readId } from "@/lib/server/api";
import { undoPass } from "@/lib/server/services/connections";

type P = { itemId: string };

/** Undo a pass so the item comes back into the deck. Idempotent. */
export const DELETE = authedRoute<P>(
  async ({ user, params }) => {
    await undoPass(user.id, readId(params.itemId, "item id"));
    return { ok: true };
  },
  { rateLimit: { name: "swipes:undo", limit: 120, windowSec: 3600 } },
);
