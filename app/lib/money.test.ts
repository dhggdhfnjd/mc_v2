import { describe, expect, it } from "vitest";
import { breakEvenC, fairBand, fxLoss, lotTotal, netPriceC, perKgFromUnit, sayable, toC, unitPrice } from "./money";
import type { CrowdStat } from "./types";

const crowd = (medianC: number, p25C: number, p75C: number, confidence: CrowdStat["confidence"]): CrowdStat => ({
  medianC, p25C, p75C, confidence, reports: 9, reporters: 7, latestAgeDays: 1,
});

describe("units and totals", () => {
  it("prices a 90 kg bag from a per-kg price", () => {
    expect(unitPrice(toC(55), 90)).toBe(4950);
    expect(lotTotal(toC(55), 2, 90)).toBe(9900);
  });
  it("round-trips a quoted bag price back to per-kg", () => {
    expect(perKgFromUnit(4250, 90)).toBe(4722);
    expect(perKgFromUnit(100, 0)).toBe(0);
  });
});

describe("fair band — official price is the anchor (D14)", () => {
  it("uses the official price with a volatility margin when the crowd is thin", () => {
    const band = fairBand(5200, crowd(6000, 5900, 6100, 1), 0.02);
    expect(band.basis).toBe("official");
    expect(band.refC).toBe(5200);
    expect(band.lowC).toBe(4940); // volatility floor of 5%
    expect(band.highC).toBe(5460);
  });
  it("lets a confident crowd refine the range", () => {
    const band = fairBand(5200, crowd(5500, 5400, 5600, 2), 0.05);
    expect(band).toMatchObject({ basis: "crowd", refC: 5500, lowC: 5390, highC: 5610 });
  });
  it("never lets the crowd drag the range beyond ±20% of the official price", () => {
    const band = fairBand(5200, crowd(9000, 8800, 9200, 3), 0.05);
    expect(band.highC).toBeLessThanOrEqual(Math.round(5200 * 1.2 * 1.02));
    expect(band.refC).toBeLessThanOrEqual(6240);
  });
  it("applies the grade factor", () => {
    expect(fairBand(5200, null, 0.05, 0.9).refC).toBe(4680);
  });
});

describe("rounding, costs, FX", () => {
  it("rounds to prices people say out loud", () => {
    expect(sayable(5037, "KES")).toBe(5050);
    expect(sayable(437, "KES")).toBe(440);
    expect(sayable(143_130, "UGX")).toBe(143_000);
    expect(sayable(1_480, "UGX")).toBe(1_500);
  });
  it("computes the break-even with spoilage", () => {
    expect(breakEvenC(8100, 180)).toBe(4500);
    expect(breakEvenC(8100, 180, 0.1)).toBe(5000);
    expect(breakEvenC(8100, 0)).toBe(0);
  });
  it("nets a distant bid down by transport, border and loss", () => {
    expect(netPriceC(6000, 270, 0, 0.005)).toBe(5700);
    expect(netPriceC(6000, 270, 100, 0)).toBe(5630);
  });
  it("shows what a street exchange rate costs", () => {
    const { lost, pct } = fxLoss(10_000, 27.9, 28.4);
    expect(lost).toBe(5000);
    expect(pct).toBeCloseTo(0.0176, 3);
  });
});
