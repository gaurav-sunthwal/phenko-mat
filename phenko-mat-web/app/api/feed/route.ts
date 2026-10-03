import { authedRoute, readQuery } from "@/lib/server/api";
import { getFeed } from "@/lib/server/services/feed";
import { feedQuerySchema } from "@/lib/validation";

export const GET = authedRoute(
  async ({ req, user }) => {
    const { category, limit, scope, q } = readQuery(req, feedQuerySchema);
    return getFeed(user.id, { categoryId: category, limit, scope, q });
  },
  { rateLimit: { name: "feed", limit: 120, windowSec: 60 } },
);
