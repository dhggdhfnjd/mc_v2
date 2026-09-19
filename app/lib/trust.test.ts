import { describe, expect, it } from "vitest";
import { aggregate, confidenceBars, isCorroborated, nextReputation, screenReport, weightedQuantile } from "./trust";
import type { CrowdReport } from "./types";

const NOW = 1_800_000_000_000;
const HOUR = 3_600_000;
const GOV = 5200;

let seq = 0;
function report(priceC: number, deviceId: string, over: Partial<CrowdReport> = {}): CrowdReport {
  return {
    id: `r${seq++}`, deviceId, origin: "deal", side: "sell", commodityId: "maize", marketId: "busia-ke",
    priceC, photo: false, status: screenReport(priceC, GOV, null), at: NOW - 5 * HOUR, ...over,
  };
}

describe("first gate: anchor to the official price", () => {
  it("refuses absurd prices outright — the 'cocoa at 1000 a bite' case", () => {
    expect(screenReport(100_000, GOV, null)).toBe("rejected");
    expect(screenReport(2000, GOV, null)).toBe("rejected");
    expect(screenReport(0, GOV, null)).toBe("rejected");
  });
  it("accepts prices near the official price or near the current median", () => {
    expect(screenReport(5500, GOV, null)).toBe("accepted");
    expect(screenReport(6600, GOV, 6400)).toBe("accepted");
  });
  it("quarantines a plausible outlier instead of trusting or deleting it", () => {
    expect(screenReport(4100, GOV, null)).toBe("quarantined");
  });
});

describe("the recording's worry: one person dragging the price down", () => {
  const honest = [5400, 5500, 5500, 5600, 5700].map((p, i) => report(p, `t${i}`));

  it("ignores a phone that spams low prices", () => {
    const spam = [2000, 2000, 2000, 2000].map((p) => report(p, "attacker"));
    expect(spam.every((r) => r.status === "rejected")).toBe(true);
    expect(aggregate([...honest, ...spam], NOW)?.medianC).toBe(5500);
  });
  it("counts one vote per device even when its prices pass the gate", () => {
    const spam = [4300, 4300, 4300, 4300, 4300, 4300].map((p, i) => report(p, "attacker", { at: NOW - i * HOUR }));
    const stat = aggregate([...honest, ...spam], NOW);
    expect(stat?.reporters).toBe(6);
    expect(stat?.medianC).toBeGreaterThanOrEqual(5400);
  });
  it("keeps a lone quarantined report out until two other devices corroborate it", () => {
    const lone = report(4100, "newcomer");
    expect(aggregate([...honest, lone], NOW)?.reporters).toBe(5);
    const followers = [report(4150, "f1"), report(4050, "f2")];
    expect(isCorroborated(lone, [lone, ...followers])).toBe(true);
    expect(aggregate([...honest, lone, ...followers], NOW)?.reporters).toBe(8);
  });
});

describe("aggregation details", () => {
  it("hides the crowd price below three independent reporters", () => {
    expect(aggregate([report(5500, "a"), report(5600, "b")], NOW)?.confidence).toBe(0);
    expect(aggregate([], NOW)).toBeNull();
  });
  it("drops reports older than the 7-day window", () => {
    const old = report(5500, "old", { at: NOW - 8 * 24 * HOUR });
    expect(aggregate([old], NOW)).toBeNull();
  });
  it("gives proven reporters more pull than new phones", () => {
    const reports = [report(5000, "new1"), report(5000, "new2"), report(6000, "pro1"), report(6000, "pro2")];
    const stat = aggregate(reports, NOW, (id) => (id.startsWith("pro") ? 1 : 0.3));
    expect(stat?.medianC).toBe(6000);
  });
  it("balances sellers against buyers so neither side can outvote the other", () => {
    const sellers = [5800, 5800, 5800, 5800, 5800].map((p, i) => report(p, `s${i}`, { side: "sell" }));
    const buyers = [5200, 5200].map((p, i) => report(p, `b${i}`, { side: "buy" }));
    expect(aggregate([...sellers, ...buyers], NOW, () => 1)?.medianC).toBe(5500);
  });
  it("computes weighted quantiles", () => {
    const items = [{ v: 1, w: 1 }, { v: 2, w: 1 }, { v: 3, w: 1 }, { v: 100, w: 0.1 }];
    expect(weightedQuantile(items, 0.5)).toBe(2);
    expect(weightedQuantile([], 0.5)).toBe(0);
  });
});

describe("confidence bars and reputation", () => {
  it("maps reporters, freshness and spread to 0–3 bars", () => {
    expect(confidenceBars(2, 0, 0.01)).toBe(0);
    expect(confidenceBars(4, 1, 0.05)).toBe(1);
    expect(confidenceBars(7, 1, 0.05)).toBe(2);
    expect(confidenceBars(7, 5, 0.05)).toBe(1);
    expect(confidenceBars(12, 1, 0.05)).toBe(3);
    expect(confidenceBars(12, 1, 0.3)).toBe(2);
  });
  it("earns trust slowly and loses it quickly, within bounds", () => {
    expect(nextReputation(0.3, "inRange")).toBe(0.35);
    expect(nextReputation(0.3, "earlySignal")).toBe(0.4);
    expect(nextReputation(0.3, "rejected")).toBe(0.15);
    expect(nextReputation(0.99, "inRange")).toBe(1);
    expect(nextReputation(0.1, "rejected")).toBe(0.1);
  });
});
