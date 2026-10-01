import { z } from "zod";
import { authedRoute, readJson, readQuery } from "@/lib/server/api";
import { recordSwipe, resetPasses, swipeSummary } from "@/lib/server/services/connections";
import { categoryIdSchema, swipeSchema } from "@/lib/validation";

export const POST = authedRoute(
  async ({ req, user }) => {
    const { itemId, direction } = await readJson(req, swipeSchema);
    return recordSwipe(user.id, itemId, direction);
  },
  { rateLimit: { name: "swipes", limit: 300, windowSec: 3600 } },
);

/** For an empty deck: how many still-listed items were passed vs. wanted (same filters as the feed). */
export const GET = authedRoute(async ({ req, user }) => {
  const { category, free } = readQuery(
    req,
    z.object({ category: categoryIdSchema.optional(), free: z.enum(["1"]).optional() }),
  );
  return swipeSummary(user.id, { categoryId: category, freeOnly: free === "1" });
});

/** Clears "pass" swipes so those items show up again. */
export const DELETE = authedRoute(async ({ req, user }) => {
  const { category } = readQuery(req, z.object({ category: categoryIdSchema.optional() }));
  await resetPasses(user.id, category);
  return { ok: true };
});
