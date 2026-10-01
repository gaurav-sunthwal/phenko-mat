import { authedRoute } from "@/lib/server/api";
import { listBlocked } from "@/lib/server/services/safety";

export const GET = authedRoute(({ user }) => listBlocked(user.id));
