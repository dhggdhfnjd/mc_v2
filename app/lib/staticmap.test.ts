import { describe, expect, it } from "vitest";
import { MARKETS } from "./catalog";
import { circleBox, distanceKm, fitView, fromWorld, kmPerPx, project, spread, staticMapUrl, toWorld } from "./staticmap";

describe("Web Mercator", () => {
  it("matches Google's documented world coordinate for Chicago", () => {
    const w = toWorld({ lat: 41.85, lon: -87.65 });
    expect(w.x).toBeCloseTo(65.67111, 4);
    expect(w.y).toBeCloseTo(95.17493, 4);
  });
  it("round-trips", () => {
    const w = toWorld({ lat: 0.4608, lon: 34.1115 });
    const p = fromWorld(w.x, w.y);
    expect(p.lat).toBeCloseTo(0.4608, 9);
    expect(p.lon).toBeCloseTo(34.1115, 9);
  });
});

describe("framing the Busia corridor", () => {
  const pad = { top: 16, right: 16, bottom: 26, left: 16 };
  const view = fitView(MARKETS, 240 / 196, pad, 400);

  it("picks the deepest zoom that fits the width budget", () => {
    expect(view.width).toBeLessThanOrEqual(400);
    expect(fitView(MARKETS, 240 / 196, pad, 10_000).zoom).toBeGreaterThan(view.zoom);
    expect(view.zoom).toBe(7);
  });

  it("keeps every market inside the padding", () => {
    for (const m of MARKETS) {
      const p = project(m, view);
      expect(p.x).toBeGreaterThanOrEqual(pad.left - 0.5);
      expect(p.x).toBeLessThanOrEqual(view.width - pad.right + 0.5);
      expect(p.y).toBeGreaterThanOrEqual(pad.top - 0.5);
      expect(p.y).toBeLessThanOrEqual(view.height - pad.bottom + 0.5);
    }
  });

  it("puts Uganda west of Kenya and Mbale north of Kisumu", () => {
    const at = (id: string) => project(MARKETS.find((m) => m.id === id)!, view);
    expect(at("kampala").x).toBeLessThan(at("busia-ug").x);
    expect(at("busia-ug").x).toBeLessThan(at("busia-ke").x);
    expect(at("mbale").y).toBeLessThan(at("kisumu").y);
  });
});

describe("spread", () => {
  it("separates coincident discs deterministically", () => {
    const [a, b] = spread([{ x: 50, y: 50, r: 10 }, { x: 50, y: 50, r: 10 }], 200, 200, 2);
    expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeGreaterThanOrEqual(21.9);
    expect(a.x).toBeLessThan(b.x);
    expect(a.y).toBe(50);
  });
  it("leaves discs that already clear each other alone", () => {
    const input = [{ x: 20, y: 20, r: 5 }, { x: 60, y: 20, r: 5 }];
    expect(spread(input, 100, 100)).toEqual(input);
  });
  it("keeps discs on the canvas", () => {
    const out = spread([{ x: 2, y: 2, r: 9 }, { x: 3, y: 2, r: 9 }], 100, 100);
    for (const d of out) {
      expect(d.x).toBeGreaterThanOrEqual(9);
      expect(d.y).toBeGreaterThanOrEqual(9);
    }
  });
  it("does not mutate its input", () => {
    const input = [{ x: 5, y: 5, r: 5 }, { x: 5, y: 5, r: 5 }];
    spread(input, 100, 100);
    expect(input[0].x).toBe(5);
  });
});

describe("staticMapUrl", () => {
  it("encodes centre, zoom, size, styles and key", () => {
    const url = new URL(staticMapUrl({ centre: { lat: 0.5, lon: 34 }, zoom: 7, width: 277, height: 226 }, "K", ["a|b"]));
    expect(url.origin + url.pathname).toBe("https://maps.googleapis.com/maps/api/staticmap");
    expect(url.searchParams.get("center")).toBe("0.50000,34.00000");
    expect(url.searchParams.get("zoom")).toBe("7");
    expect(url.searchParams.get("size")).toBe("277x226");
    expect(url.searchParams.getAll("style")).toEqual(["a|b"]);
    expect(url.searchParams.get("key")).toBe("K");
  });
});

describe("distances and circles", () => {
  const busia = { lat: 0.4608, lon: 34.1115 };
  it("measures Busia to Kisumu at about 100 km in a straight line", () => {
    expect(distanceKm(busia, { lat: -0.0917, lon: 34.768 })).toBeGreaterThan(90);
    expect(distanceKm(busia, { lat: -0.0917, lon: 34.768 })).toBeLessThan(100);
    expect(distanceKm(busia, busia)).toBe(0);
  });
  it("puts each compass point of the circle the radius away", () => {
    for (const p of circleBox(busia, 100)) expect(distanceKm(busia, p)).toBeCloseTo(100, 0);
    for (const p of circleBox({ lat: 24.8, lon: 121 }, 100)) expect(distanceKm({ lat: 24.8, lon: 121 }, p)).toBeCloseTo(100, 0);
  });
  it("frames a 100 km circle at zoom 7 near the equator, radius in pixels to match", () => {
    const view = fitView(circleBox(busia, 100), 240 / 196, { top: 6, right: 6, bottom: 6, left: 6 }, 400);
    expect(view.zoom).toBe(7);
    const r = 100 / kmPerPx(busia.lat, view.zoom);
    const north = project(circleBox(busia, 100)[0], view);
    const centre = project(busia, view);
    expect(Math.abs(centre.y - north.y)).toBeCloseTo(r, 0);
  });
});
