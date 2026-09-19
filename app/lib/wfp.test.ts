import { describe, expect, it } from "vitest";
import { getHistory, getPrices } from "./api";
import { COMMODITIES, MARKETS } from "./catalog";
import { seedDemands } from "./seed";
import { WFP_SERIES } from "./wfp";

describe("WFP-backed catalog", () => {
  it("puts eight complete products on page one and three on page two", () => {
    expect(COMMODITIES.slice(0, 8).map((c) => c.id)).toEqual([
      "maize", "tomato", "potato", "kale", "onion", "cabbage", "rice", "beans",
    ]);
    expect(COMMODITIES.slice(8).map((c) => c.id)).toEqual(["cowpea", "red-potato", "dolichos"]);
    expect(COMMODITIES.map((c) => c.dataMonths)).toEqual([66, 65, 64, 61, 61, 57, 50, 49, 59, 53, 50]);
  });

  it("keeps the 22 exact WFP markets covered by the adopted commodities", () => {
    expect(MARKETS).toHaveLength(22);
    expect(MARKETS.map(({ id, lat, lon }) => ({ id, lat, lon }))).toEqual([
      { id: "5671", lat: -0.09, lon: 34.77 },
      { id: "5670", lat: -0.48, lon: 37.13 },
      { id: "5893", lat: -4.66, lon: 39.22 },
      { id: "5672", lat: -4.06, lon: 39.66 },
      { id: "187", lat: -1.37, lon: 38.02 },
      { id: "5892", lat: -1.36, lon: 38.01 },
      { id: "5665", lat: -1.27, lon: 37.32 },
      { id: "5666", lat: -1.91, lon: 37.73 },
      { id: "5667", lat: -1.81, lon: 37.62 },
      { id: "6352", lat: -1.79, lon: 37.63 },
      { id: "5668", lat: -0.32, lon: 37.72 },
      { id: "4626", lat: -1.27, lon: 36.74 },
      { id: "5697", lat: -1.29, lon: 36.86 },
      { id: "5698", lat: -1.29, lon: 36.83 },
      { id: "3356", lat: -0.46, lon: 39.64 },
      { id: "3267", lat: 3.39, lon: 40.23 },
      { id: "3355", lat: 0.47, lon: 35.98 },
      { id: "5664", lat: -2.1, lon: 36.79 },
      { id: "5669", lat: -0.3, lon: 36.08 },
      { id: "185", lat: 0.52, lon: 35.28 },
      { id: "5896", lat: 1.44, lon: 35.57 },
      { id: "5897", lat: 1.25, lon: 35.08 },
    ]);
    const ids = new Set(MARKETS.map((m) => m.id));
    expect(new Set(MARKETS.map((m) => `${m.lat},${m.lon}`))).toHaveLength(22);
    expect(Object.values(WFP_SERIES).every((series) => ids.has(series.marketId))).toBe(true);
  });

  it("does not generate a demo buyer merely because a market exists", () => {
    const demands = seedDemands("maize", Date.UTC(2026, 6, 15));
    expect(new Set(demands.map((d) => d.marketId))).toEqual(new Set(["5671", "4626", "5666"]));
    expect(new Set(demands.map((d) => d.username)).size).toBe(demands.length);
    expect(demands.length).toBeGreaterThan(3);
  });

  it("normalizes the latest source package without losing its original value", async () => {
    const price = await getPrices("maize");
    expect(price).toMatchObject({
      marketId: "5671",
      packagePriceKes: 5249.93,
      unitLabel: "90 kg",
      unitKg: 90,
      priceC: 5833,
      source: "WFP",
      priceType: "Wholesale",
      priceFlag: "actual",
    });
    expect(new Date(price.observedAt).toISOString().slice(0, 10)).toBe("2026-07-15");
  });

  it("keeps missing months blank in history", async () => {
    const history = await getHistory("maize", 12);
    expect(history.points).toHaveLength(12);
    expect(history.observations).toBe(11);
    expect(history.points.filter((p) => p === null)).toHaveLength(1);
    expect(history.nowC).toBe(5833);
  });
});
