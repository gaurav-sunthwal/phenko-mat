import { requireOptionalNativeModule } from "expo";

interface PlaceSuggestion {
  id: string;
  title: string;
  subtitle: string;
}

interface ResolvedPlace {
  lat: number;
  lng: number;
  area: string;
}

interface ApplePlacesModule {
  autocomplete(query: string, lat: number | null, lng: number | null): Promise<PlaceSuggestion[]>;
  resolve(id: string): Promise<ResolvedPlace>;
}

/** Apple Maps search (iOS dev/production builds only); null elsewhere, e.g. Android or Expo Go. */
export const ApplePlaces = requireOptionalNativeModule<ApplePlacesModule>("ApplePlaces");
