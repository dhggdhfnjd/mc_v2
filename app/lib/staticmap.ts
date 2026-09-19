// Geography for the demand map's optional Google Static Maps basemap. Pure maths, no React:
// frame the markets in one fixed image, project lat/lon onto it, and push overlapping bubbles
// apart (the twin Busia towns are 2 km apart, i.e. the same pixel at this zoom).
//
// One image covers every market, so its URL never changes: switching food only redraws the SVG
// overlay and the HTTP cache serves the basemap again. That matters on Cloud Phone, where the
// user pays for screen updates.

export interface LatLon {
  lat: number;
  lon: number;
}

export interface Pad {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** what to ask the Static Maps API for; width/height are image pixels at scale=1 */
export interface MapView {
  centre: LatLon;
  zoom: number;
  width: number;
  height: number;
}

const TILE = 256;
const MAX_LAT = 85.05112878;

/** Web Mercator world coordinates at zoom 0 (Google's "world coordinates") */
export function toWorld(p: LatLon): { x: number; y: number } {
  const lat = Math.max(-MAX_LAT, Math.min(MAX_LAT, p.lat));
  const s = Math.sin((lat * Math.PI) / 180);
  return {
    x: TILE * (0.5 + p.lon / 360),
    y: TILE * (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)),
  };
}

export function fromWorld(x: number, y: number): LatLon {
  const lon = (x / TILE - 0.5) * 360;
  const n = Math.PI * (1 - (2 * y) / TILE);
  return { lat: (Math.atan(Math.sinh(n)) * 180) / Math.PI, lon };
}

/**
 * The deepest integer zoom at which every point, plus padding, fits in an image of the given
 * aspect ratio no wider than maxWidth. The image is shown scaled to the screen, so maxWidth
 * bounds how much it gets shrunk.
 */
export function fitView(points: LatLon[], aspect: number, pad: Pad, maxWidth: number): MapView {
  const w = points.map(toWorld);
  const x0 = Math.min(...w.map((p) => p.x));
  const x1 = Math.max(...w.map((p) => p.x));
  const y0 = Math.min(...w.map((p) => p.y));
  const y1 = Math.max(...w.map((p) => p.y));
  for (let zoom = 20; zoom >= 0; zoom--) {
    const k = 2 ** zoom;
    const needW = (x1 - x0) * k + pad.left + pad.right;
    const needH = (y1 - y0) * k + pad.top + pad.bottom;
    const width = Math.ceil(Math.max(needW, needH * aspect));
    if (width > maxWidth && zoom > 0) continue;
    const height = Math.round(width / aspect);
    // centre the padded box, so uneven padding shifts the points away from the heavy side
    const cx = (x0 + x1) / 2 + (pad.right - pad.left) / 2 / k;
    const cy = (y0 + y1) / 2 + (pad.bottom - pad.top) / 2 / k;
    return { centre: fromWorld(cx, cy), zoom, width, height };
  }
  throw new Error("unreachable");
}

/** pixel position of a point on the view's image */
export function project(p: LatLon, view: MapView): { x: number; y: number } {
  const k = 2 ** view.zoom;
  const a = toWorld(p);
  const c = toWorld(view.centre);
  return { x: (a.x - c.x) * k + view.width / 2, y: (a.y - c.y) * k + view.height / 2 };
}

export interface Disc {
  x: number;
  y: number;
  r: number;
}

/**
 * Push overlapping discs apart until each pair is at least `gap` apart, keeping them inside
 * width × height. Deterministic: coincident discs split left/right in input order.
 */
export function spread<T extends Disc>(discs: T[], width: number, height: number, gap = 2, rounds = 60): T[] {
  const out = discs.map((d) => ({ ...d }));
  for (let round = 0; round < rounds; round++) {
    let moved = false;
    for (let i = 0; i < out.length; i++) {
      for (let j = i + 1; j < out.length; j++) {
        const a = out[i];
        const b = out[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let dist = Math.hypot(dx, dy);
        const need = a.r + b.r + gap;
        if (dist >= need) continue;
        if (dist < 1e-6) [dx, dy, dist] = [1, 0, 1];
        const push = (need - dist) / 2;
        a.x -= (dx / dist) * push;
        a.y -= (dy / dist) * push;
        b.x += (dx / dist) * push;
        b.y += (dy / dist) * push;
        moved = true;
      }
    }
    for (const d of out) {
      d.x = Math.max(d.r, Math.min(width - d.r, d.x));
      d.y = Math.max(d.r, Math.min(height - d.r, d.y));
    }
    if (!moved) break;
  }
  return out;
}

/**
 * Dark, label-free basemap in the app's palette. Labels are off because Cloud Phone streams the
 * bitmap compressed and small map text turns to mush; market names are drawn by us in SVG.
 */
export const MAP_STYLE: string[] = [
  "element:labels|visibility:off",
  "element:geometry|color:0x0b130f",
  "feature:poi|visibility:off",
  "feature:transit|visibility:off",
  "feature:administrative|element:geometry|visibility:off",
  "feature:administrative.country|element:geometry.stroke|visibility:on|color:0x8fae98|weight:1",
  "feature:water|element:geometry|color:0x12283a",
  "feature:road|element:geometry|color:0x243a2e",
  "feature:road.highway|element:geometry|color:0x3a5a47",
  "feature:road.local|visibility:off",
];

export function staticMapUrl(view: MapView, key: string, style: string[] = MAP_STYLE): string {
  const q = new URLSearchParams({
    center: `${view.centre.lat.toFixed(5)},${view.centre.lon.toFixed(5)}`,
    zoom: String(view.zoom),
    size: `${view.width}x${view.height}`,
    scale: "1",
    format: "png8",
    maptype: "roadmap",
  });
  for (const s of style) q.append("style", s);
  q.append("key", key);
  return `https://maps.googleapis.com/maps/api/staticmap?${q.toString()}`;
}
