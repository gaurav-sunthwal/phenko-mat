import { authedRoute, readId } from "@/lib/server/api";
import { getPublicProfile } from "@/lib/server/services/users";

export const GET = authedRoute<{ id: string }>(({ user, params }) => getPublicProfile(user.id, readId(params.id, "user id")));
