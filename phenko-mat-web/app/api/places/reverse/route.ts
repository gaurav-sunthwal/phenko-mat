import { authedRoute, readQuery } from "@/lib/server/api";
import { reverseGeocode } from "@/lib/server/services/places";
import { reverseGeocodeQuerySchema } from "@/lib/validation";

/** Area name for a spot picked on the map. (A static segment, so it wins over /api/places/[id].) */
export const GET = authedRoute(
  ({ req }) => {
    const { lat, lng } = readQuery(req, reverseGeocodeQuerySchema);
    return reverseGeocode(lat, lng);
  },
  { rateLimit: { name: "places:reverse", limit: 120, windowSec: 3600 } },
);
