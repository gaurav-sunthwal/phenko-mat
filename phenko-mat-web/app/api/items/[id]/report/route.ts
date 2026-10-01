import { authedRoute, readId, readJson } from "@/lib/server/api";
import { reportItem } from "@/lib/server/services/items";
import { reportSchema } from "@/lib/validation";

export const POST = authedRoute<{ id: string }>(
  async ({ req, user, params }) => {
    await reportItem(user.id, readId(params.id, "item id"), await readJson(req, reportSchema));
    return { ok: true };
  },
  { rateLimit: { name: "items:report", limit: 20, windowSec: 86_400, store: "shared" } },
);
