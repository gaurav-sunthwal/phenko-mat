import { authedRoute } from "@/lib/server/api";
import { listConnections } from "@/lib/server/services/connections";

export const GET = authedRoute(({ user }) => listConnections(user.id));
