import { authedRoute, readQuery } from "@/lib/server/api";
import { getFeed } from "@/lib/server/services/feed";
import { feedQuerySchema } from "@/lib/validation";

export const GET = authedRoute(
  async ({ req, user }) => {
    const { category, limit, scope, q, free } = readQuery(req, feedQuerySchema);
    return getFeed(user.id, { categoryId: category, limit, scope, q, freeOnly: free === "1" });
  },
  { rateLimit: { name: "feed", limit: 120, windowSec: 60 } },
);
