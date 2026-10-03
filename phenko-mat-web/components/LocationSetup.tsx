"use client";

import { useEffect, useRef, useState } from "react";
import { useSWRConfig } from "swr";
import { ApiRequestError, api, fetcher } from "@/lib/client/api";
import type { Me, PlaceSuggestion, ResolvedPlace } from "@/lib/dto";
import { LocateIcon, PinIcon } from "./icons";

/**
 * Coordinates come from the browser and stay server-side; other people only ever see the area
 * name and a rounded distance.
 */
const SEARCH_DEBOUNCE_MS = 300;
const MAX_SUGGESTIONS = 5;
// ~100 m precision is plenty for "nearby" and avoids storing a doorstep.
const round = (n: number) => Math.round(n * 1000) / 1000;

export function LocationForm({ me, onDone }: { me?: Me; onDone?: () => void }) {
  const { mutate } = useSWRConfig();
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(me?.location ?? null);
  const [area, setArea] = useState(me?.area ?? "");
  const [radius, setRadius] = useState(me?.radiusKm ?? 10);
  const [status, setStatus] = useState<"idle" | "locating" | "saving">("idle");
  const [error, setError] = useState<string | null>(null);
  // Place search (same as the app): only for text the user typed, not an area we filled in ourselves.
  const [typed, setTyped] = useState(false);
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [picking, setPicking] = useState(false);
  const [searching, setSearching] = useState(false);
  // Groups the keystrokes and the final pick, so Google bills them as one search.
  const session = useRef(crypto.randomUUID());
  const near = coords ?? me?.location ?? null;

  useEffect(() => {
    const q = area.trim();
    if (!typed || q.length < 2) return;
    const abort = new AbortController();
    const timer = window.setTimeout(() => {
      setSearching(true);
      const qs = new URLSearchParams({ q, session: session.current });
      if (near) {
        qs.set("lat", String(near.lat));
        qs.set("lng", String(near.lng));
      }
      fetch(`/api/places?${qs}`, { credentials: "same-origin", signal: abort.signal })
        .then((r) => (r.ok ? (r.json() as Promise<PlaceSuggestion[]>) : []))
        .then((list) => setSuggestions(list.slice(0, MAX_SUGGESTIONS)))
        // Search is a convenience: if it's down, typing the area by hand still works.
        .catch(() => undefined)
        .finally(() => {
          if (!abort.signal.aborted) setSearching(false);
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      abort.abort();
      setSearching(false);
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
      const place = await fetcher<ResolvedPlace>(`/api/places/${encodeURIComponent(s.id)}?session=${session.current}`);
      setCoords({ lat: round(place.lat), lng: round(place.lng) });
      setArea(place.area);
      setTyped(false);
      setSuggestions([]);
      session.current = crypto.randomUUID();
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : "Couldn't find that place. Try another, or use your location.");
    } finally {
      setPicking(false);
    }
  }

  function locate() {
    if (!("geolocation" in navigator)) {
      setError("Your browser doesn't support location.");
      return;
    }
    setStatus("locating");
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: round(pos.coords.latitude), lng: round(pos.coords.longitude) });
        setTyped(false);
        setStatus("idle");
      },
      () => {
        setError("We couldn't get your location. Please allow location access and try again.");
        setStatus("idle");
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 300_000 },
    );
  }

  async function save() {
    if (!coords) return setError("Pick your area from the suggestions, or tap “Use my location”.");
    if (area.trim().length < 2) return setError("Tell neighbours your area, e.g. “Koregaon Park”.");
    setStatus("saving");
    setError(null);
    try {
      const updated = await api<Me>("PATCH", "/api/me", {
        location: { ...coords, area: area.trim() },
        radiusKm: radius,
      });
      await mutate("/api/me", updated, { revalidate: false });
      // Everything distance-based is now stale.
      await mutate((key) => typeof key === "string" && (key.startsWith("/api/feed") || key === "/api/categories"));
      onDone?.();
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : "Couldn't save. Try again.");
    } finally {
      setStatus("idle");
    }
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={locate}
        disabled={status !== "idle"}
        className={`flex w-full items-center justify-center gap-2 rounded-full px-5 py-3.5 font-bold transition ${
          coords ? "bg-cream text-ink" : "bg-ink text-white"
        }`}
      >
        <LocateIcon size={20} />
        {status === "locating" ? "Locating…" : coords ? "Location set · update" : "Use my location"}
      </button>

      <label className="block">
        <span className="mb-1.5 flex items-center justify-between text-sm font-bold">
          Your area
          {(searching || picking) && (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-honey-deep border-t-transparent" role="status" aria-label="Searching" />
          )}
        </span>
        <input
          value={area}
          onChange={(e) => {
            setArea(e.target.value);
            setTyped(true);
          }}
          maxLength={80}
          placeholder="Search your area, e.g. Koregaon Park"
          autoComplete="off"
          role="combobox"
          aria-expanded={shown.length > 0}
          aria-controls="place-suggestions"
          className="w-full rounded-2xl border-2 border-line bg-white px-4 py-3 outline-none focus:border-honey"
        />
        {shown.length > 0 && (
          <ul id="place-suggestions" role="listbox" className="mt-2 overflow-hidden rounded-2xl border-2 border-line bg-white">
            {shown.map((s) => (
              <li key={s.id} role="option" aria-selected={false}>
                <button
                  type="button"
                  disabled={picking}
                  onClick={() => pick(s)}
                  className="flex w-full items-start gap-2 border-b border-line px-4 py-2.5 text-left last:border-b-0 hover:bg-cream disabled:opacity-60"
                >
                  <PinIcon size={16} className="mt-0.5 shrink-0 text-ink-soft" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold">{s.title}</span>
                    {s.subtitle && <span className="block truncate text-xs text-ink-soft">{s.subtitle}</span>}
                  </span>
                </button>
              </li>
            ))}
            {/* Google's terms require attribution when showing Places results without a Google map. */}
            <li className="px-4 py-1.5 text-right text-[11px] text-ink-soft" aria-hidden="true">
              Powered by Google
            </li>
          </ul>
        )}
        <span className="mt-1 block text-xs text-ink-soft">This is what others see — never your exact address.</span>
      </label>

      <label className="block">
        <span className="mb-1.5 flex justify-between text-sm font-bold">
          Show things within <span>{radius} km</span>
        </span>
        <input
          type="range"
          min={1}
          max={50}
          value={radius}
          onChange={(e) => setRadius(Number(e.target.value))}
          className="w-full accent-[#f5b400]"
        />
      </label>

      {error && (
        <p className="text-sm font-medium text-[#B42318]" role="alert">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={save}
        disabled={status !== "idle" || picking}
        className="w-full rounded-full bg-honey px-5 py-3.5 font-extrabold text-ink transition hover:bg-honey-deep disabled:opacity-60"
      >
        {status === "saving" ? "Saving…" : "Save location"}
      </button>
    </div>
  );
}

export function LocationSetup({ onDone }: { onDone?: () => void }) {
  return (
    <div className="flex flex-1 flex-col justify-center px-6 py-8">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-honey text-4xl">📍</div>
        <h2 className="text-2xl font-extrabold">Where are you?</h2>
        <p className="mt-2 text-ink-soft">We&apos;ll show you things people are passing on near you.</p>
      </div>
      <LocationForm onDone={onDone} />
    </div>
  );
}
