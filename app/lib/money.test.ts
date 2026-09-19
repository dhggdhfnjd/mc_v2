import { describe, expect, it } from "vitest";
import { breakEvenC, changeDue, counterOffer, fairBand, fxLoss, judge, lotDelta, lotTotal, netPriceC, perKgFromUnit, sayable, toC, unitPrice } from "./money";
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
  it("gives change and never a negative amount", () => {
    expect(changeDue(10000, 9700)).toBe(300);
    expect(changeDue(9000, 9700)).toBe(0);
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

describe("verdict and money at stake", () => {
  const band = fairBand(5200, crowd(5500, 5300, 5700, 2), 0.05);
  it("judges a seller's incoming offer", () => {
    expect(judge("sell", 5600, band)).toBe("good");
    expect(judge("sell", 5400, band)).toBe("fair");
    expect(judge("sell", 4722, band)).toBe("bad");
  });
  it("mirrors the logic for a buyer", () => {
    expect(judge("buy", 5400, band)).toBe("good");
    expect(judge("buy", 5650, band)).toBe("fair");
    expect(judge("buy", 6200, band)).toBe("bad");
  });
  it("states the difference in shillings on the whole lot", () => {
    expect(lotDelta("sell", 4722, 5500, 180)).toBe(-1400);
    expect(lotDelta("buy", 5000, 5500, 180)).toBe(900);
  });
});

describe("counter-offer", () => {
  const band = fairBand(5200, crowd(5500, 5300, 5700, 2), 0.05);
  it("asks above the offer and concedes as the offer rises", () => {
    const first = counterOffer("sell", 4700, band, null);
    const second = counterOffer("sell", 5400, band, null);
    expect(first).toBeGreaterThan(5300);
    expect(second).toBeLessThan(first);
    expect(second).toBeGreaterThanOrEqual(5400);
  });
  it("gives a lowball nothing and meets a fair offer at the market reference", () => {
    const open = counterOffer("sell", 0, band, null);
    expect(counterOffer("sell", 3000, band, null)).toBe(open);
    expect(counterOffer("sell", band.refC, band, null)).toBe(band.refC);
    expect(counterOffer("sell", 6000, band, null)).toBe(6000); // better than we hoped: take it
  });
  it("opens a buyer low and walks up towards the reference", () => {
    const open = counterOffer("buy", 0, band, null);
    expect(open).toBeLessThan(band.lowC);
    expect(counterOffer("buy", 5800, band, null)).toBeGreaterThan(open);
    expect(counterOffer("buy", 5000, band, null)).toBe(5000);
  });
  it("never goes below the seller's own cost", () => {
    expect(counterOffer("sell", 3000, band, 6500)).toBeGreaterThanOrEqual(6500);
  });
  it("never bids above the buyer's limit", () => {
    expect(counterOffer("buy", 9000, band, 5000)).toBeLessThanOrEqual(5000);
    expect(counterOffer("buy", 6000, band, null)).toBeLessThanOrEqual(band.highC);
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
