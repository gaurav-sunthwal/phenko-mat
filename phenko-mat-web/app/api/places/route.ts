import { authedRoute, readQuery } from "@/lib/server/api";
import { autocompletePlaces } from "@/lib/server/services/places";
import { placesQuerySchema } from "@/lib/validation";

/** Location search suggestions (Google Places). The key stays on the server. */
export const GET = authedRoute(({ req }) => autocompletePlaces(readQuery(req, placesQuerySchema)), {
  rateLimit: { name: "places", limit: 300, windowSec: 3600 },
});
