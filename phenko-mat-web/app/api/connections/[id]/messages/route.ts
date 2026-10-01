import { authedRoute, readId, readJson, readQuery } from "@/lib/server/api";
import { listMessages, sendMessage } from "@/lib/server/services/connections";
import { messageSchema, messagesQuerySchema } from "@/lib/validation";

type P = { id: string };

export const GET = authedRoute<P>(
  async ({ req, user, params }) => {
    const { after, before } = readQuery(req, messagesQuerySchema);
    return listMessages(user.id, readId(params.id, "chat id"), { after, before });
  },
  // Chat polls every few seconds; allow that comfortably but cap abuse.
  { rateLimit: { name: "messages:list", limit: 60, windowSec: 60 } },
);

export const POST = authedRoute<P>(
  async ({ req, user, params }) => {
    const { body, clientId } = await readJson(req, messageSchema);
    return sendMessage(user.id, readId(params.id, "chat id"), body, clientId);
  },
  { rateLimit: { name: "messages:send", limit: 30, windowSec: 60 } },
);
