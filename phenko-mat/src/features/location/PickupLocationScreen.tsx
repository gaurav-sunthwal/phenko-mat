import * as Location from "expo-location";
import { AppleMaps } from "expo-maps";
import { router } from "expo-router";
import { useEffect, useRef, useState, type Ref } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, FormError, LocateIcon, PinIcon, SearchIcon, Text, TextField } from "@/components/ui";
import type { ListingPlace } from "@/features/listing/draft";
import { BackTitle } from "@/features/shell/ScreenTitle";
import { errorMessage } from "@/lib/api/errors";
import type { PlaceSuggestion } from "@/shared/dto";
import { colors, radius } from "@/theme";
import { createPlaceSession, nameSpot } from "./places";

type LatLng = { lat: number; lng: number };

const SEARCH_DEBOUNCE_MS = 300;
const NAME_DEBOUNCE_MS = 600;
const MAX_SUGGESTIONS = 5;
/** Street level: close enough to pick a building, far enough to recognise the neighbourhood. */
const ZOOM = 17;
/** ~1 m: an exact pickup spot, without float noise. */
const round = (n: number) => Math.round(n * 100_000) / 100_000;
const key = (p: LatLng) => `${p.lat},${p.lng}`;

/** expo-maps draws Apple Maps with SwiftUI's Map (iOS 17+). Elsewhere: search + current location only. */
const MAP_AVAILABLE = Platform.OS === "ios" && Number.parseInt(String(Platform.Version), 10) >= 17;

/**
 * Where a listing is picked up: search a place, use the current location, then drag the map under the
 * fixed pin to the exact spot. The pin is only used for distances — others see the area name.
 */
export function PickupLocationScreen({
  initial,
  onSave,
  onUseProfileArea,
}: {
  initial: ListingPlace | null;
  onSave: (place: ListingPlace) => void;
  /** Shown when the listing has its own spot and the owner has a profile area to go back to. */
  onUseProfileArea?: () => void;
}) {
  const insets = useSafeAreaInsets();
  const map = useRef<AppleMaps.MapView>(null);
  const [pin, setPin] = useState<LatLng | null>(initial ? { lat: initial.lat, lng: initial.lng } : null);
  const [area, setArea] = useState(initial?.area ?? "");
  // The owner typed the area name: don't overwrite it when the pin moves.
  const [areaEdited, setAreaEdited] = useState(false);
  const [naming, setNaming] = useState(false);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [busy, setBusy] = useState<"picking" | "locating" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const places = useRef(createPlaceSession());
  const lastNamed = useRef(initial ? key(initial) : "");

  /** Moves the pin (and the map, when the move didn't come from the map itself). */
  function moveTo(next: LatLng, fromMap = false) {
    const p = { lat: round(next.lat), lng: round(next.lng) };
    setPin(p);
    if (!fromMap) map.current?.setCameraPosition({ coordinates: { latitude: p.lat, longitude: p.lng }, zoom: ZOOM });
  }

  // Suggestions as you type.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const abort = new AbortController();
    const timer = setTimeout(() => {
      places.current
        .search(q, pin, abort.signal)
        .then((list) => {
          if (!abort.signal.aborted) setSuggestions(list.slice(0, MAX_SUGGESTIONS));
        })
        // Search is a convenience: the map and current location still work without it.
        .catch(() => undefined);
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
    // `pin` only biases results; re-searching when the map moves would flash the list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // Name the spot once the pin settles somewhere new (unless the owner wrote the name).
  useEffect(() => {
    if (!pin || areaEdited || key(pin) === lastNamed.current) return;
    const abort = new AbortController();
    const timer = setTimeout(() => {
      setNaming(true);
      void nameSpot(pin.lat, pin.lng, abort.signal)
        .then((name) => {
          if (abort.signal.aborted) return;
          lastNamed.current = key(pin);
          if (name) setArea(name);
        })
        .finally(() => {
          if (!abort.signal.aborted) setNaming(false);
        });
    }, NAME_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [pin, areaEdited]);

  const shown = query.trim().length >= 2 ? suggestions : [];

  async function pick(s: PlaceSuggestion) {
    setBusy("picking");
    setError(null);
    try {
      const place = await places.current.resolve(s.id);
      const p = { lat: round(place.lat), lng: round(place.lng) };
      lastNamed.current = key(p);
      moveTo(p);
      setArea(place.area);
      setAreaEdited(false);
      setQuery("");
      setSuggestions([]);
      places.current = createPlaceSession();
    } catch (e) {
      setError(errorMessage(e, "Couldn't find that place. Try another, or use your current location."));
    } finally {
      setBusy(null);
    }
  }

  async function locate() {
    setBusy("locating");
    setError(null);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== "granted") {
        setError("We couldn't get your location. Allow location access, or search instead.");
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setAreaEdited(false);
      moveTo({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    } catch {
      setError("We couldn't get your location. Allow location access, or search instead.");
    } finally {
      setBusy(null);
    }
  }

  function save() {
    if (!pin) return setError("Search for a place, or use your current location, to put the pin down.");
    if (area.trim().length < 2) return setError("Add the area name people will see, e.g. “Koregaon Park”.");
    onSave({ ...pin, area: area.trim() });
  }

  return (
    <KeyboardAvoidingView behavior="padding" style={[styles.root, { paddingTop: insets.top + 12 }]}>
      <BackTitle title="Pickup location" fallback="/new" />

      <View style={styles.top}>
        <TextField
          value={query}
          onChangeText={setQuery}
          maxLength={100}
          placeholder="Search an address, building or landmark"
          autoCorrect={false}
          returnKeyType="search"
          prefix={busy === "picking" ? <ActivityIndicator size="small" color={colors.honeyDeep} /> : <SearchIcon size={18} color={colors.inkSoft} />}
        />
        {shown.length ? (
          <View style={styles.suggestions} accessibilityRole="list">
            {shown.map((s, i) => (
              <Pressable
                key={s.id}
                onPress={() => void pick(s)}
                disabled={busy !== null}
                style={({ pressed }) => [styles.suggestion, i > 0 && styles.divider, pressed && styles.pressed]}
                accessibilityRole="button"
                accessibilityLabel={[s.title, s.subtitle].filter(Boolean).join(", ")}
              >
                <PinIcon size={16} color={colors.inkSoft} />
                <View style={styles.flex}>
                  <Text weight="bold" size="sm" numberOfLines={1}>
                    {s.title}
                  </Text>
                  {s.subtitle ? (
                    <Text size="xs" color={colors.inkSoft} numberOfLines={1}>
                      {s.subtitle}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            ))}
            {/* Google's terms require attribution when showing Places results without a Google map. */}
            {Platform.OS === "ios" ? null : (
              <Text size="xs" color={colors.inkSoft} align="right" style={styles.attribution}>
                Powered by Google
              </Text>
            )}
          </View>
        ) : null}
        <Button
          block
          size="md"
          variant="cream"
          icon={<LocateIcon size={18} />}
          label={busy === "locating" ? "Locating…" : "Use my current location"}
          onPress={() => void locate()}
          disabled={busy !== null}
        />
      </View>

      <View style={styles.mapArea}>
        {pin && MAP_AVAILABLE ? (
          <>
            <PinMap ref={map} start={pin} onMove={(p) => moveTo(p, true)} onTap={(p) => moveTo(p)} />
            {/* The pin's tip sits on the map's centre. */}
            <View style={styles.pin} pointerEvents="none">
              <PinIcon size={44} fill={colors.honey} strokeWidth={1.8} />
            </View>
          </>
        ) : (
          <View style={styles.mapPlaceholder}>
            <Text size="sm" color={colors.inkSoft} align="center">
              {pin
                ? "Pin set. Fine-tune it by searching a nearby landmark, or stand at the spot and use your current location."
                : "Search for a place or use your current location to put the pin down."}
            </Text>
          </View>
        )}
      </View>

      <View style={[styles.bottom, { paddingBottom: Math.max(16, insets.bottom) }]}>
        {pin && MAP_AVAILABLE ? (
          <Text size="xs" color={colors.inkSoft}>
            Drag the map or tap a spot to put the pin exactly where it&apos;s picked up.
          </Text>
        ) : null}
        <TextField
          label="Area name people see"
          value={area}
          onChangeText={(v) => {
            setArea(v);
            setAreaEdited(true);
          }}
          maxLength={80}
          placeholder="e.g. Koregaon Park, Pune"
          hint="People see this and the distance — never the exact spot."
          autoCapitalize="words"
          prefix={naming ? <ActivityIndicator size="small" color={colors.honeyDeep} /> : undefined}
        />
        <FormError message={error} />
        <View style={styles.actions}>
          {onUseProfileArea ? <Button variant="outline" label="Use my area" onPress={onUseProfileArea} style={styles.flex} /> : null}
          <Button variant="honey" weight="extrabold" label="Use this spot" onPress={save} disabled={busy !== null} style={styles.flex} />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

/** The map under the fixed pin. Mounted once a pin exists; later moves go through the ref. */
function PinMap({
  ref,
  start,
  onMove,
  onTap,
}: {
  ref: Ref<AppleMaps.MapView>;
  start: LatLng;
  onMove: (p: LatLng) => void;
  onTap: (p: LatLng) => void;
}) {
  // Only the first position is passed as a prop, so a re-render never yanks the map out from under a pan.
  const [camera] = useState(() => ({ coordinates: { latitude: start.lat, longitude: start.lng }, zoom: ZOOM }));
  const toLatLng = ({ latitude, longitude }: { latitude?: number; longitude?: number }) =>
    latitude !== undefined && longitude !== undefined ? { lat: latitude, lng: longitude } : null;
  return (
    <AppleMaps.View
      ref={ref}
      style={StyleSheet.absoluteFill}
      cameraPosition={camera}
      uiSettings={{ compassEnabled: false, myLocationButtonEnabled: false, togglePitchEnabled: false }}
      properties={{ selectionEnabled: false }}
      onCameraMove={(e) => {
        const p = toLatLng(e.coordinates);
        if (p) onMove(p);
      }}
      onMapClick={(e) => {
        const p = toLatLng(e.coordinates);
        if (p) onTap(p);
      }}
    />
  );
}

/** Leaves the picker (it's pushed from the listing form). */
export const closePickupLocation = () => (router.canGoBack() ? router.back() : router.replace("/new"));

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  flex: { flex: 1, minWidth: 0 },
  top: { paddingHorizontal: 16, gap: 10, zIndex: 2 },
  suggestions: { borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, overflow: "hidden" },
  suggestion: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 10 },
  divider: { borderTopWidth: 1, borderTopColor: colors.line },
  pressed: { backgroundColor: colors.cream },
  attribution: { paddingHorizontal: 14, paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.line },
  mapArea: { flex: 1, minHeight: 200, marginTop: 12, marginHorizontal: 16, borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.cream },
  // Bottom of the icon (its tip) on the centre line.
  pin: { position: "absolute", left: "50%", top: "50%", marginLeft: -22, marginTop: -42 },
  mapPlaceholder: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  bottom: { paddingHorizontal: 16, paddingTop: 12, gap: 10 },
  actions: { flexDirection: "row", gap: 10 },
});
