// Crowd-price trust engine (architecture §7). Pure functions — no identity checks, only
// behaviour: anchor to the official price, one vote per device, robust median, decay, reputation.

import type { CrowdReport, CrowdStat, ReportStatus } from "./types";

const DAY = 86_400_000;
export const WINDOW_DAYS = 7;
export const HALF_LIFE_DAYS = 3;
export const MIN_REPORTERS = 3;

/**
 * First gate. Anything below half or above double the official price is refused outright
 * ("cocoa at 1000 a bite"). Within that, a report must sit within ±20% of either the official
 * price or the current crowd median, otherwise it waits in quarantine for corroboration.
 */
export function screenReport(priceC: number, govC: number, medianC: number | null): ReportStatus {
  if (priceC <= 0 || priceC < govC * 0.5 || priceC > govC * 2) return "rejected";
  const near = (anchor: number) => Math.abs(priceC / anchor - 1) <= 0.2;
  return near(govC) || (medianC !== null && near(medianC)) ? "accepted" : "quarantined";
}

/** A quarantined report is released once 2 other devices land within ±10% of it inside 48 h. */
export function isCorroborated(target: CrowdReport, all: CrowdReport[]): boolean {
  const devices = new Set<string>();
  for (const r of all) {
    if (r.deviceId === target.deviceId || r.status === "rejected") continue;
    if (r.commodityId !== target.commodityId || r.marketId !== target.marketId) continue;
    if (Math.abs(r.at - target.at) > 2 * DAY) continue;
    if (Math.abs(r.priceC / target.priceC - 1) <= 0.1) devices.add(r.deviceId);
  }
  return devices.size >= 2;
}

export function weightedQuantile(items: { v: number; w: number }[], q: number): number {
  const sorted = [...items].sort((a, b) => a.v - b.v);
  const total = sorted.reduce((s, i) => s + i.w, 0);
  if (sorted.length === 0 || total <= 0) return 0;
  let acc = 0;
  for (const i of sorted) {
    acc += i.w;
    if (acc >= total * q) return i.v;
  }
  return sorted[sorted.length - 1].v;
}

export function reportWeight(r: CrowdReport, reputation: number, now: number): number {
  const ageDays = Math.max(0, (now - r.at) / DAY);
  const decay = Math.pow(0.5, ageDays / HALF_LIFE_DAYS);
  const origin = r.origin === "deal" ? 1.2 : r.origin === "bid" ? 0.5 : 1;
  return reputation * decay * origin * (r.photo ? 1.5 : 1);
}

export function confidenceBars(reporters: number, latestAgeDays: number, dispersion: number): 0 | 1 | 2 | 3 {
  if (reporters < MIN_REPORTERS) return 0;
  if (reporters < 5 || latestAgeDays > 4) return 1;
  return reporters >= 10 && dispersion <= 0.1 ? 3 : 2;
}

/**
 * Aggregate the reports for ONE commodity at ONE market.
 * `reputation(deviceId)` returns 0.3 (new) … 1.0 (proven).
 */
export function aggregate(
  reports: CrowdReport[],
  now: number,
  reputation: (deviceId: string) => number = () => 0.6,
): CrowdStat | null {
  const usable = reports.filter(
    (r) =>
      now - r.at <= WINDOW_DAYS * DAY &&
      (r.status === "accepted" || (r.status === "quarantined" && isCorroborated(r, reports))),
  );
  // one device, one vote: only the latest report per device counts
  const latest = new Map<string, CrowdReport>();
  for (const r of usable) {
    const prev = latest.get(r.deviceId);
    if (!prev || r.at > prev.at) latest.set(r.deviceId, r);
  }
  const votes = [...latest.values()];
  if (votes.length === 0) return null;

  const weigh = (rs: CrowdReport[]) => rs.map((r) => ({ v: r.priceC, w: reportWeight(r, reputation(r.deviceId), now) }));
  const all = weigh(votes);

  // Sellers like to report high and buyers low. When both sides are present, take each side's
  // median separately so whichever side has more phones cannot drag the price.
  const sell = votes.filter((r) => r.side === "sell");
  const buy = votes.filter((r) => r.side === "buy");
  const medianC =
    sell.length >= 2 && buy.length >= 2
      ? Math.round((weightedQuantile(weigh(sell), 0.5) + weightedQuantile(weigh(buy), 0.5)) / 2)
      : weightedQuantile(all, 0.5);

  const p25C = weightedQuantile(all, 0.25);
  const p75C = weightedQuantile(all, 0.75);
  const latestAgeDays = Math.min(...votes.map((r) => (now - r.at) / DAY));
  const dispersion = medianC > 0 ? (p75C - p25C) / medianC : 1;
  return {
    medianC,
    p25C,
    p75C,
    reports: usable.length,
    reporters: votes.length,
    latestAgeDays,
    confidence: confidenceBars(votes.length, latestAgeDays, dispersion),
  };
}

/** Behaviour-based reputation step, applied after a day's final range is known. */
export function nextReputation(current: number, outcome: "inRange" | "rejected" | "earlySignal"): number {
  const delta = outcome === "inRange" ? 0.05 : outcome === "earlySignal" ? 0.1 : -0.15;
  return Math.min(1, Math.max(0.1, Math.round((current + delta) * 100) / 100));
}
