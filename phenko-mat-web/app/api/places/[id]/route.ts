import { authedRoute, readQuery } from "@/lib/server/api";
import { resolvePlace } from "@/lib/server/services/places";
import { placeDetailsQuerySchema } from "@/lib/validation";

type P = { id: string };

/** Coordinates and area name for a picked suggestion. */
export const GET = authedRoute<P>(
  ({ req, params }) => resolvePlace(params.id, readQuery(req, placeDetailsQuerySchema).session),
  { rateLimit: { name: "places:details", limit: 60, windowSec: 3600 } },
);
