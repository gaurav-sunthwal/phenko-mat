import { ApplePlaces } from "@modules/apple-places";
import * as Location from "expo-location";
import { Platform } from "react-native";
import { randomUUID } from "expo-crypto";
import { api, qs } from "@/lib/api/client";
import type { PlaceSuggestion, ResolvedPlace } from "@/shared/dto";

/**
 * Location search. iOS asks Apple Maps on the device (no key, no network hop through us); everything
 * else goes through our API, which calls Google Places with a server-side key.
 *
 * A session groups the keystrokes and the final pick, so Google bills them as one search.
 */
export function createPlaceSession() {
  const session = randomUUID();
  return {
    search(q: string, near?: { lat: number; lng: number } | null, signal?: AbortSignal): Promise<PlaceSuggestion[]> {
      if (ApplePlaces) return ApplePlaces.autocomplete(q, near?.lat ?? null, near?.lng ?? null);
      return api.get<PlaceSuggestion[]>(`/api/places${qs({ q, session, lat: near?.lat, lng: near?.lng })}`, signal);
    },
    resolve(id: string): Promise<ResolvedPlace> {
      if (ApplePlaces) return ApplePlaces.resolve(id);
      return api.get<ResolvedPlace>(`/api/places/${encodeURIComponent(id)}${qs({ session })}`);
    },
  };
}

/**
 * The area name for a spot picked on a map ("Koregaon Park, Pune"), or null if it can't be named.
 * iOS uses Apple's on-device geocoder; elsewhere our API asks Google.
 */
export async function nameSpot(lat: number, lng: number, signal?: AbortSignal): Promise<string | null> {
  if (Platform.OS === "ios") {
    const [place] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng }).catch(() => []);
    const local = place?.district ?? place?.subregion ?? place?.name;
    const parts = [local, place?.city].filter((p, i, all): p is string => Boolean(p) && all.indexOf(p) === i);
    return parts.length ? parts.join(", ").slice(0, 80) : null;
  }
  const res = await api.get<{ area: string }>(`/api/places/reverse${qs({ lat, lng })}`, signal).catch(() => null);
  return res?.area ?? null;
}
