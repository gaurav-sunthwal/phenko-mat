import "server-only";
import type { PlaceSuggestion, ResolvedPlace } from "@/lib/dto";
import { placesEnv } from "../env";
import { ApiError, badRequest, notFound } from "../errors";

const BASE = "https://places.googleapis.com/v1";
/** Suggestions lean towards (not limited to) this radius around the user, when we know where they are. */
const BIAS_RADIUS_M = 50_000;
const TIMEOUT_MS = 5_000;

type AddressComponent = { longText: string; shortText: string; types: string[] };

function apiKey() {
  const env = placesEnv();
  if (!env) throw new ApiError(503, "PLACES_UNAVAILABLE", "Location search isn't available right now. Type your area instead.");
  return env.GOOGLE_MAPS_API_KEY;
}

async function google<T>(path: string, init: RequestInit & { fieldMask: string }): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": apiKey(), "X-Goog-FieldMask": init.fieldMask },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (res.status === 404) throw notFound("Place");
  if (res.status === 400) throw badRequest("Couldn't look that place up.");
  if (!res.ok) {
    console.error("[places] google error", res.status, await res.text().catch(() => ""));
    throw new ApiError(502, "PLACES_FAILED", "Location search failed. Try again, or type your area.");
  }
  return (await res.json()) as T;
}

export async function autocompletePlaces(opts: {
  q: string;
  session: string;
  lat?: number;
  lng?: number;
}): Promise<PlaceSuggestion[]> {
  const body = {
    input: opts.q,
    sessionToken: opts.session,
    languageCode: "en",
    ...(opts.lat !== undefined &&
      opts.lng !== undefined && {
        locationBias: { circle: { center: { latitude: opts.lat, longitude: opts.lng }, radius: BIAS_RADIUS_M } },
      }),
  };
  const data = await google<{
    suggestions?: {
      placePrediction?: {
        placeId: string;
        text?: { text: string };
        structuredFormat?: { mainText?: { text: string }; secondaryText?: { text: string } };
      };
    }[];
  }>("/places:autocomplete", {
    method: "POST",
    body: JSON.stringify(body),
    fieldMask:
      "suggestions.placePrediction.placeId,suggestions.placePrediction.text.text,suggestions.placePrediction.structuredFormat",
  });

  return (data.suggestions ?? []).flatMap(({ placePrediction: p }) =>
    p
      ? [
          {
            id: p.placeId,
            title: p.structuredFormat?.mainText?.text ?? p.text?.text ?? "",
            subtitle: p.structuredFormat?.secondaryText?.text ?? "",
          },
        ]
      : [],
  );
}

/** "Neighbourhood, City" from Google address components; falls back to the place's own name. */
function areaName(components: AddressComponent[], displayName: string | undefined) {
  const find = (...types: string[]) => components.find((c) => types.some((t) => c.types.includes(t)))?.longText;
  const local = find("sublocality_level_1", "sublocality", "neighborhood") ?? displayName;
  const city = find("locality", "postal_town", "administrative_area_level_2");
  const parts = [local, city].filter((p, i, all): p is string => Boolean(p) && all.indexOf(p) === i);
  return parts.join(", ").slice(0, 80);
}

export async function resolvePlace(placeId: string, session: string): Promise<ResolvedPlace> {
  if (!/^[\w-]{10,300}$/.test(placeId)) throw badRequest("Invalid place.");
  const data = await google<{
    location?: { latitude: number; longitude: number };
    addressComponents?: AddressComponent[];
    displayName?: { text: string };
  }>(`/places/${encodeURIComponent(placeId)}?sessionToken=${encodeURIComponent(session)}&languageCode=en`, {
    method: "GET",
    fieldMask: "location,addressComponents,displayName",
  });
  if (!data.location) throw notFound("Place");
  const area = areaName(data.addressComponents ?? [], data.displayName?.text);
  return { lat: data.location.latitude, lng: data.location.longitude, area: area || "Unknown area" };
}

/**
 * Names a spot picked on the map ("Koregaon Park, Pune") via the Google Geocoding API, which must be
 * enabled for the same key. Rounded to ~100 m first: the name is all we need, and it keeps exact
 * pickup spots out of Google's request logs.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<{ area: string }> {
  const round = (n: number) => Math.round(n * 1000) / 1000;
  const qs = new URLSearchParams({
    latlng: `${round(lat)},${round(lng)}`,
    language: "en",
    result_type: "sublocality|neighborhood|locality",
    key: apiKey(),
  });
  const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${qs}`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  const data = (await res.json().catch(() => null)) as {
    status?: string;
    results?: { address_components: { long_name: string; short_name: string; types: string[] }[] }[];
  } | null;
  if (data?.status === "ZERO_RESULTS") throw notFound("Place");
  if (!res.ok || data?.status !== "OK" || !data.results?.length) {
    console.error("[places] geocode error", res.status, data?.status);
    throw new ApiError(502, "PLACES_FAILED", "Couldn't name that spot. Type the area instead.");
  }
  const components = data.results[0].address_components.map((c) => ({ longText: c.long_name, shortText: c.short_name, types: c.types }));
  const area = areaName(components, undefined);
  if (!area) throw notFound("Place");
  return { area };
}
