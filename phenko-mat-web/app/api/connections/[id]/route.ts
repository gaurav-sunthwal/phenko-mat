import { authedRoute, readId } from "@/lib/server/api";
import { getConnection, removeConnection } from "@/lib/server/services/connections";

export const GET = authedRoute<{ id: string }>(({ user, params }) =>
  getConnection(user.id, readId(params.id, "chat id")),
);

export const DELETE = authedRoute<{ id: string }>(async ({ user, params }) => {
  await removeConnection(user.id, readId(params.id, "chat id"));
  return { ok: true };
});
