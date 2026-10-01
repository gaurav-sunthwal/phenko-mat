import { z } from "zod";
import { authedRoute, readJson, readQuery } from "@/lib/server/api";
import { recordSwipe, resetPasses } from "@/lib/server/services/connections";
import { categoryIdSchema, swipeSchema } from "@/lib/validation";

export const POST = authedRoute(
  async ({ req, user }) => {
    const { itemId, direction } = await readJson(req, swipeSchema);
    return recordSwipe(user.id, itemId, direction);
  },
  { rateLimit: { name: "swipes", limit: 300, windowSec: 3600 } },
);

/** Clears "pass" swipes so those items show up again. */
export const DELETE = authedRoute(async ({ req, user }) => {
  const { category } = readQuery(req, z.object({ category: categoryIdSchema.optional() }));
  await resetPasses(user.id, category);
  return { ok: true };
});
