import { authedRoute } from "@/lib/server/api";
import { isBearerRequest } from "@/lib/server/auth";
import { issueTicket } from "@/lib/server/realtime";

/** Mints a 60-second, single-use ticket for opening the chat WebSocket. */
export const POST = authedRoute(async ({ req, user }) => issueTicket(user.id, isBearerRequest(req)), {
  rateLimit: { name: "realtime:ticket", limit: 30, windowSec: 60 },
});
