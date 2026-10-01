"use client";

import { useEffect, useRef, useState } from "react";
import { ApiRequestError, fetcher } from "@/lib/client/api";
import type { PlaceSuggestion, ResolvedPlace } from "@/lib/dto";
import { LocateIcon, PinIcon, SearchIcon } from "./icons";
import { PinMap, type LatLng } from "./PinMap";

export interface ListingPlace extends LatLng {
  area: string;
}

const SEARCH_DEBOUNCE_MS = 300;
const NAME_DEBOUNCE_MS = 600;
const MAX_SUGGESTIONS = 5;
/** ~1 m: an exact pickup spot, without float noise. */
const round = (n: number) => Math.round(n * 100_000) / 100_000;

/**
 * Where a listing is picked up. Collapsed it's one line ("📍 Koregaon Park · Change"); opened it offers
 * place search, "use my current location" and a map to drop the pin exactly. The pin is only used for
 * distances — others see the area name, never the spot.
 *
 * `value` null means "not chosen": the listing goes at `fallback` (the owner's profile location).
 */
export function ListingLocationPicker({
  value,
  fallback,
  onChange,
}: {
  value: ListingPlace | null;
  fallback: ListingPlace | null;
  onChange: (next: ListingPlace | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = value ?? fallback;

  if (!open) {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-cream px-4 py-3">
        <PinIcon size={20} className="shrink-0" />
        <p className="min-w-0 flex-1 text-sm">
          {current ? (
            <>
              Pickup near <strong>{current.area}</strong>
              {!value && <span className="text-ink-soft"> (your area)</span>}
            </>
          ) : (
            "Choose where it can be picked up"
          )}
          <span className="block text-xs text-ink-soft">People see the area and distance, never the exact spot.</span>
        </p>
        <button type="button" onClick={() => setOpen(true)} className="shrink-0 rounded-full bg-white px-3.5 py-2 text-sm font-bold">
          {current ? "Change" : "Choose"}
        </button>
      </div>
    );
  }

  return (
    <PickerPanel
      initial={current}
      onDone={(place) => {
        onChange(place);
        setOpen(false);
      }}
      onCancel={() => setOpen(false)}
      onReset={value && fallback ? () => (onChange(null), setOpen(false)) : undefined}
    />
  );
}

function PickerPanel({
  initial,
  onDone,
  onCancel,
  onReset,
}: {
  initial: ListingPlace | null;
  onDone: (place: ListingPlace) => void;
  onCancel: () => void;
  onReset?: () => void;
}) {
  const [pin, setPin] = useState<LatLng | null>(initial ? { lat: initial.lat, lng: initial.lng } : null);
  const [area, setArea] = useState(initial?.area ?? "");
  // The user typed the area name themselves: don't overwrite it when the pin moves.
  const [areaEdited, setAreaEdited] = useState(false);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [busy, setBusy] = useState<"picking" | "locating" | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Groups the keystrokes and the final pick, so Google bills them as one search.
  const session = useRef(crypto.randomUUID());

  // Suggestions as you type.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) return;
    const abort = new AbortController();
    const timer = window.setTimeout(() => {
      const qs = new URLSearchParams({ q, session: session.current });
      if (pin) {
        qs.set("lat", String(pin.lat));
        qs.set("lng", String(pin.lng));
      }
      fetch(`/api/places?${qs}`, { credentials: "same-origin", signal: abort.signal })
        .then((r) => (r.ok ? (r.json() as Promise<PlaceSuggestion[]>) : []))
        .then((list) => setSuggestions(list.slice(0, MAX_SUGGESTIONS)))
        // Search is a convenience: the map and "use my location" still work without it.
        .catch(() => undefined);
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      abort.abort();
    };
    // `pin` only biases results; re-searching when the map moves would flash the list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // Name the spot whenever the pin settles somewhere new (unless the user wrote the name).
  const lastNamed = useRef(initial ? `${initial.lat},${initial.lng}` : "");
  useEffect(() => {
    if (!pin || areaEdited) return;
    const key = `${pin.lat},${pin.lng}`;
    if (key === lastNamed.current) return;
    const abort = new AbortController();
    const timer = window.setTimeout(() => {
      fetch(`/api/places/reverse?lat=${pin.lat}&lng=${pin.lng}`, { credentials: "same-origin", signal: abort.signal })
        .then((r) => (r.ok ? (r.json() as Promise<{ area: string }>) : null))
        .then((res) => {
          lastNamed.current = key;
          if (res?.area) setArea(res.area);
        })
        // No name? The user can type one; the pin still counts.
        .catch(() => undefined);
    }, NAME_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      abort.abort();
    };
  }, [pin, areaEdited]);

  const shown = query.trim().length >= 2 ? suggestions : [];

  async function pick(s: PlaceSuggestion) {
    setBusy("picking");
    setError(null);
    try {
      const place = await fetcher<ResolvedPlace>(`/api/places/${encodeURIComponent(s.id)}?session=${session.current}`);
      const next = { lat: round(place.lat), lng: round(place.lng) };
      lastNamed.current = `${next.lat},${next.lng}`;
      setPin(next);
      setArea(place.area);
      setAreaEdited(false);
      setQuery("");
      setSuggestions([]);
      session.current = crypto.randomUUID();
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : "Couldn't find that place. Try another, or move the map.");
    } finally {
      setBusy(null);
    }
  }

  function locate() {
    if (!("geolocation" in navigator)) return setError("Your browser doesn't support location.");
    setBusy("locating");
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPin({ lat: round(pos.coords.latitude), lng: round(pos.coords.longitude) });
        setAreaEdited(false);
        setBusy(null);
      },
      () => {
        setError("We couldn't get your location. Allow location access, or search instead.");
        setBusy(null);
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  }

  function done() {
    if (!pin) return setError("Search for a place, or use your current location, to put the pin down.");
    if (area.trim().length < 2) return setError("Add the area name people will see, e.g. “Koregaon Park”.");
    onDone({ ...pin, area: area.trim() });
  }

  return (
    <section className="space-y-3 rounded-[28px] bg-white p-4 md:p-5" aria-label="Pickup location">
      <div className="flex items-center justify-between">
        <h2 className="font-extrabold">Pickup location</h2>
        <button type="button" onClick={onCancel} className="text-sm font-bold text-ink-soft hover:text-ink">
          Cancel
        </button>
      </div>

      <div className="relative">
        <label className="flex items-center gap-2 rounded-2xl border-2 border-line bg-white px-4 focus-within:border-honey">
          <SearchIcon size={18} className="shrink-0 text-ink-soft" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            maxLength={100}
            placeholder="Search an address, building or landmark"
            autoComplete="off"
            role="combobox"
            aria-expanded={shown.length > 0}
            aria-controls="listing-place-suggestions"
            className="w-full bg-transparent py-3 outline-none"
          />
        </label>
        {shown.length > 0 && (
          <ul
            id="listing-place-suggestions"
            role="listbox"
            className="absolute inset-x-0 top-full z-[1100] mt-1 overflow-hidden rounded-2xl border-2 border-line bg-white shadow-lg"
          >
            {shown.map((s) => (
              <li key={s.id} role="option" aria-selected={false}>
                <button
                  type="button"
                  disabled={busy !== null}
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
          </ul>
        )}
      </div>

      <button
        type="button"
        onClick={locate}
        disabled={busy !== null}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-cream px-5 py-2.5 text-sm font-bold disabled:opacity-60"
      >
        <LocateIcon size={18} />
        {busy === "locating" ? "Locating…" : "Use my current location"}
      </button>

      {pin ? (
        <>
          <PinMap center={pin} onMove={(c) => setPin({ lat: round(c.lat), lng: round(c.lng) })} className="h-64 md:h-72" />
          <p className="text-xs text-ink-soft">Drag the map or tap a spot to put the pin exactly where it&apos;s picked up.</p>
        </>
      ) : (
        <div className="flex h-40 items-center justify-center rounded-2xl border-2 border-dashed border-line px-6 text-center text-sm text-ink-soft">
          Search for a place or use your current location — then fine-tune the pin on the map.
        </div>
      )}

      <label className="block">
        <span className="mb-1.5 block text-sm font-bold">Area name people see</span>
        <input
          value={area}
          onChange={(e) => {
            setArea(e.target.value);
            setAreaEdited(true);
          }}
          maxLength={80}
          placeholder="e.g. Koregaon Park, Pune"
          className="w-full rounded-2xl border-2 border-line bg-white px-4 py-3 outline-none focus:border-honey"
        />
      </label>

      {error && (
        <p className="text-sm font-medium text-[#B42318]" role="alert">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        {onReset && (
          <button type="button" onClick={onReset} className="flex-1 rounded-full border-2 border-line px-4 py-3 text-sm font-bold">
            Use my area
          </button>
        )}
        <button
          type="button"
          onClick={done}
          disabled={busy !== null}
          className="flex-1 rounded-full bg-honey px-4 py-3 font-extrabold transition hover:bg-honey-deep disabled:opacity-60"
        >
          Use this spot
        </button>
      </div>
    </section>
  );
}
