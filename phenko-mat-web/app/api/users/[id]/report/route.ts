import { authedRoute, readId, readJson } from "@/lib/server/api";
import { reportUser } from "@/lib/server/services/safety";
import { reportSchema } from "@/lib/validation";

export const POST = authedRoute<{ id: string }>(
  async ({ req, user, params }) => {
    await reportUser(user.id, readId(params.id, "user id"), await readJson(req, reportSchema));
    return { ok: true };
  },
  { rateLimit: { name: "users:report", limit: 20, windowSec: 86_400, store: "shared" } },
);
