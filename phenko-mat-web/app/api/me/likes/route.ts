import { authedRoute } from "@/lib/server/api";
import { listLikedItems } from "@/lib/server/services/items";

export const GET = authedRoute(({ user }) => listLikedItems(user.id));
