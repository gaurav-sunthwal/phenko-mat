import { authedRoute, readId } from "@/lib/server/api";
import { blockUser, unblockUser } from "@/lib/server/services/safety";

type P = { id: string };

export const POST = authedRoute<P>(
  async ({ user, params }) => {
    await blockUser(user.id, readId(params.id, "user id"));
    return { ok: true };
  },
  { rateLimit: { name: "users:block", limit: 30, windowSec: 3600 } },
);

export const DELETE = authedRoute<P>(async ({ user, params }) => {
  await unblockUser(user.id, readId(params.id, "user id"));
  return { ok: true };
});
