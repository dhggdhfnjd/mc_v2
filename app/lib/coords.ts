// Typing a latitude or longitude on a keypad, and finding the market nearest to a point.
// Digits type, * is the decimal point, # flips the sign, Del removes the last character.

import type { Key } from "../core/keypad";
import { MARKETS } from "./catalog";
import { distanceKm, type LatLon } from "./staticmap";
import type { Market } from "./types";

const MAX_LEN = 10;

/** the edited text, or null when the key is not part of number entry */
export function typeCoord(current: string, key: Key): string | null {
  if (key === "#") return current.startsWith("-") ? current.slice(1) : `-${current}`;
  if (key === "*") {
    if (current.includes(".")) return current;
    const digits = current.replace("-", "");
    return `${current.startsWith("-") ? "-" : ""}${digits === "" ? "0" : digits}.`;
  }
  if (key === "Del") return current.slice(0, -1);
  if (key.length === 1 && key >= "0" && key <= "9") {
    if (current.replace(/[-.]/g, "").length >= MAX_LEN) return current;
    return current === "0" || current === "-0" ? current.slice(0, -1) + key : current + key;
  }
  return null;
}

/** a finite number inside the limit, or null */
export function parseCoord(text: string, limit: number): number | null {
  if (!/^-?\d+(\.\d*)?$/.test(text)) return null;
  const v = Number(text);
  return Number.isFinite(v) && Math.abs(v) <= limit ? v : null;
}

export function nearestMarket(p: LatLon): { market: Market; km: number } {
  let best = MARKETS[0];
  let bestKm = Infinity;
  for (const m of MARKETS) {
    const km = distanceKm(p, m);
    if (km < bestKm) [best, bestKm] = [m, km];
  }
  return { market: best, km: bestKm };
}
