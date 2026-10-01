import { authedRoute, readId } from "@/lib/server/api";
import { markRead } from "@/lib/server/services/connections";

export const POST = authedRoute<{ id: string }>(async ({ user, params }) => {
  await markRead(user.id, readId(params.id, "chat id"));
  return { ok: true };
});
