import { authedRoute } from "@/lib/server/api";
import { listMyItems } from "@/lib/server/services/items";

export const GET = authedRoute(({ user }) => listMyItems(user.id));
