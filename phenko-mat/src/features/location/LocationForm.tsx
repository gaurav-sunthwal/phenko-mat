import Slider from "@react-native-community/slider";
import * as Location from "expo-location";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Linking, Platform, Pressable, StyleSheet, View } from "react-native";
import { Button, FormError, LocateIcon, PinIcon, Text, TextField } from "@/components/ui";
import { useUpdateMe } from "@/features/profile/api";
import { errorMessage } from "@/lib/api/errors";
import type { Me, PlaceSuggestion } from "@/shared/dto";
import { colors, radius } from "@/theme";
import { createPlaceSession } from "./places";

const SEARCH_DEBOUNCE_MS = 300;
const MAX_SUGGESTIONS = 5;

/** ~100 m precision is plenty for "nearby" and avoids storing a doorstep. */
const round = (n: number) => Math.round(n * 1000) / 1000;

/**
 * Coordinates come from the device and stay server-side; other people only ever see the area
 * name and a rounded distance.
 */
export function LocationForm({ me, onDone }: { me?: Me; onDone?: () => void }) {
  const updateMe = useUpdateMe();
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(me?.location ?? null);
  const [area, setArea] = useState(me?.area ?? "");
  const [radius, setRadius] = useState(me?.radiusKm ?? 10);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deniedForever, setDeniedForever] = useState(false);
  // Place search: only runs for text the user typed (not for an area we filled in ourselves).
  const [typed, setTyped] = useState(false);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [picking, setPicking] = useState(false);
  const places = useRef(createPlaceSession());
  const near = coords ?? me?.location ?? null;

  useEffect(() => {
    const q = area.trim();
    if (!typed || q.length < 2) return;
    const abort = new AbortController();
    const timer = setTimeout(() => {
      setSearching(true);
      places.current
        .search(q, near, abort.signal)
        .then((list) => {
          if (!abort.signal.aborted) setSuggestions(list.slice(0, MAX_SUGGESTIONS));
        })
        // Search is a convenience: if it's down, typing the area by hand still works.
        .catch(() => {
          if (!abort.signal.aborted) setSuggestions([]);
        })
        .finally(() => {
          if (!abort.signal.aborted) setSearching(false);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
    // `near` only biases results; re-searching when it changes would flash the list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [area, typed]);

  // Stale results stay in state but only show while the typed text is still searchable.
  const shown = typed && area.trim().length >= 2 ? suggestions : [];

  async function pick(s: PlaceSuggestion) {
    setPicking(true);
    setError(null);
    try {
      const place = await places.current.resolve(s.id);
      setCoords({ lat: round(place.lat), lng: round(place.lng) });
      setArea(place.area);
      setTyped(false);
      setSuggestions([]);
      places.current = createPlaceSession();
    } catch (e) {
      setError(errorMessage(e, "Couldn't find that place. Try another, or use your location."));
    } finally {
      setPicking(false);
    }
  }

  async function locate() {
    setLocating(true);
    setError(null);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== "granted") {
        setDeniedForever(!perm.canAskAgain);
        setError("We couldn't get your location. Please allow location access and try again.");
        return;
      }
      const pos =
        (await Location.getLastKnownPositionAsync({ maxAge: 300_000 })) ??
        (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
      const next = { lat: round(pos.coords.latitude), lng: round(pos.coords.longitude) };
      setCoords(next);
      setTyped(false);

      // Native nicety: suggest the neighbourhood name so people don't have to type it.
      if (!area.trim()) {
        const [place] = await Location.reverseGeocodeAsync({ latitude: next.lat, longitude: next.lng }).catch(() => []);
        const suggestion = [place?.district ?? place?.subregion, place?.city].filter(Boolean).join(", ");
        if (suggestion) setArea(suggestion.slice(0, 80));
      }
    } catch {
      setError("We couldn't get your location. Please allow location access and try again.");
    } finally {
      setLocating(false);
    }
  }

  async function save() {
    if (!coords) return setError("Pick your area from the suggestions, or tap “Use my location”.");
    if (area.trim().length < 2) return setError("Tell neighbours your area, e.g. “Koregaon Park”.");
    setError(null);
    try {
      await updateMe.mutateAsync({ location: { ...coords, area: area.trim() }, radiusKm: radius });
      onDone?.();
    } catch (e) {
      setError(errorMessage(e, "Couldn't save. Try again."));
    }
  }

  const busy = locating || picking || updateMe.isPending;

  return (
    <View style={styles.form}>
      <Button
        block
        variant={coords ? "cream" : "ink"}
        icon={<LocateIcon size={20} color={coords ? colors.ink : colors.white} />}
        label={locating ? "Locating…" : coords ? "Location set · update" : "Use my location"}
        onPress={locate}
        disabled={busy}
      />

      <View>
        <TextField
          label="Your area"
          value={area}
          onChangeText={(v) => {
            setArea(v);
            setTyped(true);
          }}
          maxLength={80}
          placeholder="Search e.g. Koregaon Park, Pune"
          hint="Others only see this area name — never your exact address."
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="done"
          prefix={searching || picking ? <ActivityIndicator size="small" color={colors.honeyDeep} /> : undefined}
        />
        {shown.length ? (
          <View style={styles.suggestions} accessibilityRole="list">
            {shown.map((s, i) => (
              <Pressable
                key={s.id}
                onPress={() => void pick(s)}
                disabled={picking}
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
      </View>

      <View>
        <View style={styles.radiusLabel}>
          <Text weight="bold" size="sm">
            Show things within
          </Text>
          <Text weight="bold" size="sm">
            {radius} km
          </Text>
        </View>
        <Slider
          minimumValue={1}
          maximumValue={50}
          step={1}
          value={radius}
          onValueChange={(v) => setRadius(Math.round(v))}
          minimumTrackTintColor={colors.honeyDeep}
          maximumTrackTintColor={colors.line}
          thumbTintColor={colors.honeyDeep}
          accessibilityLabel="Search radius in kilometres"
        />
      </View>

      <FormError message={error} />
      {deniedForever ? (
        <Button variant="outline" size="sm" label="Open settings" onPress={() => void Linking.openSettings()} />
      ) : null}

      <Button block variant="honey" weight="extrabold" label={updateMe.isPending ? "Saving…" : "Save location"} onPress={save} disabled={busy} />
    </View>
  );
}

export function LocationSetup({ onDone }: { onDone?: () => void }) {
  return (
    <View style={styles.setup}>
      <View style={styles.setupHead}>
        <View style={styles.pinCircle}>
          <Text size={36}>📍</Text>
        </View>
        <Text weight="extrabold" size="2xl" align="center">
          Where are you?
        </Text>
        <Text color={colors.inkSoft} align="center" style={styles.mt2}>
          We&apos;ll show you things people are giving away near you.
        </Text>
      </View>
      <LocationForm onDone={onDone} />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 16 },
  flex: { flex: 1, minWidth: 0 },
  suggestions: {
    marginTop: 8,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    overflow: "hidden",
  },
  suggestion: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 10 },
  divider: { borderTopWidth: 1, borderTopColor: colors.line },
  pressed: { backgroundColor: colors.cream },
  attribution: { paddingHorizontal: 14, paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.line },
  radiusLabel: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  setup: { flex: 1, justifyContent: "center", paddingHorizontal: 24, paddingVertical: 32 },
  setupHead: { alignItems: "center", marginBottom: 24 },
  pinCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.honey,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  mt2: { marginTop: 8 },
});
