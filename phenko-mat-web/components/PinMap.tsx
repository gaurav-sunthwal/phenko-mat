"use client";

import "leaflet/dist/leaflet.css";
import type { Map as LeafletMap } from "leaflet";
import { useEffect, useRef } from "react";
import { PinIcon } from "./icons";

export interface LatLng {
  lat: number;
  lng: number;
}

/** Street level: close enough to pick a building, far enough to recognise the neighbourhood. */
const ZOOM = 17;
/** Moves smaller than this (~1 m) are echoes of our own `setView`, not the user panning. */
const SAME = 0.00001;
const same = (a: LatLng, b: LatLng) => Math.abs(a.lat - b.lat) < SAME && Math.abs(a.lng - b.lng) < SAME;

/**
 * A map with a fixed pin in the middle: drag the map (or tap a spot) to put the pin where you want it.
 * OpenStreetMap tiles via Leaflet, loaded on the client only. `center` is controlled — search results and
 * "use my location" move the map; the user's panning comes back through `onMove`.
 */
export function PinMap({ center, onMove, className = "" }: { center: LatLng; onMove: (c: LatLng) => void; className?: string }) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  // The map's listeners are attached once; they read the latest props through this.
  const latest = useRef({ center, onMove });
  useEffect(() => {
    latest.current = { center, onMove };
  });

  useEffect(() => {
    let cancelled = false;
    void import("leaflet").then((L) => {
      if (cancelled || !el.current) return;
      const m = L.map(el.current, { zoomControl: true, attributionControl: true }).setView(
        [latest.current.center.lat, latest.current.center.lng],
        ZOOM,
      );
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).addTo(m);
      m.on("moveend", () => {
        const c = m.getCenter();
        const next = { lat: c.lat, lng: c.lng };
        if (!same(next, latest.current.center)) latest.current.onMove(next);
      });
      // Tapping a spot moves the pin there.
      m.on("click", (e) => m.panTo(e.latlng));
      map.current = m;
    });
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
  }, []);

  // Follow `center` when it changes from outside (search pick, current location).
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    const c = m.getCenter();
    if (!same({ lat: c.lat, lng: c.lng }, center)) m.setView([center.lat, center.lng], Math.max(m.getZoom(), ZOOM - 2));
  }, [center]);

  return (
    <div className={`relative isolate overflow-hidden rounded-2xl border-2 border-line bg-cream ${className}`}>
      <div ref={el} className="h-full w-full" aria-label="Map. Drag to place the pin on the pickup spot." role="application" />
      {/* The pin's tip sits on the map's centre. */}
      <div className="pointer-events-none absolute top-1/2 left-1/2 z-[1000] -translate-x-1/2 -translate-y-full text-ink drop-shadow-md">
        <PinIcon size={40} fill="var(--color-honey, #FFC629)" strokeWidth={1.8} />
      </div>
    </div>
  );
}
