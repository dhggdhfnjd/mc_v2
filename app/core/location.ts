"use client";

// Where is the phone? navigator.geolocation works on Cloud Phone (confirmed on the itel R60+,
// 19 Sep 2026) as well as in ordinary browsers. ?at=lat,lon overrides it for demos, and when it
// is denied or times out we fall back to the market the user picked. The source is always
// shown, so a guess never passes for a fix.

import type { LatLon } from "../lib/staticmap";

export type FixSource = "demo" | "gps" | "market";

export interface Fix extends LatLon {
  source: FixSource;
  /** metres, as reported by the browser */
  accuracyM?: number;
}

/** ?at=0.46,34.11 pins the location, e.g. to demo Busia from a laptop in Hsinchu */
export function demoFix(): Fix | null {
  if (typeof window === "undefined") return null;
  const at = new URLSearchParams(window.location.search).get("at");
  const m = at?.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
  if (!m) return null;
  const lat = Number(m[1]);
  const lon = Number(m[2]);
  return Math.abs(lat) <= 85 && Math.abs(lon) <= 180 ? { lat, lon, source: "demo" } : null;
}

export function gpsFix(timeoutMs = 10_000): Promise<Fix | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude, accuracyM: p.coords.accuracy, source: "gps" }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 10 * 60_000 },
    );
  });
}
