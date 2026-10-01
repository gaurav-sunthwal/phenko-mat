import { authedRoute, readId } from "@/lib/server/api";
import { getItemStats } from "@/lib/server/services/items";

type P = { id: string };

/** Views, swipes, chats and reports for one of the user's own listings. */
export const GET = authedRoute<P>(({ user, params }) => getItemStats(user.id, readId(params.id, "item id")));
