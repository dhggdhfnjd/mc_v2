// Deterministic demo data. It stands in for the ingest pipeline (KAMIS daily prices, WFP monthly
// prices) and for other traders' phones, so the prototype behaves like a populated service.

import { COMMODITIES, MARKETS, commodity, market } from "./catalog";
import { screenReport } from "./trust";
import type { CrowdReport, Demand } from "./types";

const DAY = 86_400_000;

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function prng(seed: string): () => number {
  let a = hash(seed) || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** today's official price, KES cents per kg, grade 1 */
export function govTodayC(commodityId: string, marketId: string): number {
  const c = commodity(commodityId);
  const m = market(marketId);
  const jitter = 0.97 + prng(`gov:${commodityId}:${marketId}`)() * 0.06;
  const level = m.mult * (m.country === "UG" ? c.ugFactor : 1) * jitter;
  return Math.round(c.govKes * level * 100);
}

/** seasonal index for a date, interpolated between mid-month anchors so months do not jump */
export function seasonAt(season: number[], when: Date): number {
  const month = when.getMonth();
  const daysIn = new Date(when.getFullYear(), month + 1, 0).getDate();
  const pos = (when.getDate() - 0.5) / daysIn - 0.5; // −0.5 … +0.5 around mid-month
  const other = (month + (pos < 0 ? 11 : 1)) % 12;
  const w = Math.abs(pos);
  return season[month] * (1 - w) + season[other] * w;
}

/** official daily series, index 0 = today, going back `days` days; KES cents per kg */
export function officialSeries(commodityId: string, marketId: string, days: number, now: number): number[] {
  const c = commodity(commodityId);
  const today = govTodayC(commodityId, marketId);
  const base = seasonAt(c.season, new Date(now));
  const rnd = prng(`walk:${commodityId}:${marketId}`);
  const out: number[] = [];
  let walk = 0;
  for (let d = 0; d < days; d++) {
    if (d > 0) walk = walk * 0.97 + (rnd() - 0.5) * 0.022;
    const ratio = seasonAt(c.season, new Date(now - d * DAY)) / base;
    out.push(Math.round(today * ratio * (1 + walk)));
  }
  return out;
}

/** How fresh the official number is: Kenya has a daily government feed, Uganda only monthly data. */
export function officialMeta(marketId: string, now: number): { source: string; at: number } {
  return market(marketId).country === "KE"
    ? { source: "KAMIS", at: now - 1 * DAY }
    : { source: "WFP monthly", at: now - 12 * DAY };
}

const FORCED_REPORTERS: Record<string, number> = {
  "maize:busia-ke": 7,
  "beans:busia-ke": 11,
  "tomato:busia-ke": 4,
  "cabbage:busia-ke": 1,
  "maize:busia-ug": 6,
};

export function seedReports(commodityId: string, marketId: string, now: number): CrowdReport[] {
  const key = `${commodityId}:${marketId}`;
  const rnd = prng(`crowd:${key}`);
  const popularity = Math.max(0, 1 - COMMODITIES.findIndex((c) => c.id === commodityId) / 14);
  const n = FORCED_REPORTERS[key] ?? Math.floor(rnd() * 9 * popularity + rnd() * 3);
  const gov = govTodayC(commodityId, marketId);
  const premium = 1.02 + rnd() * 0.05; // street prices run a little above the official wholesale figure
  const reports: CrowdReport[] = [];
  for (let i = 0; i < n; i++) {
    const priceC = Math.round(gov * premium * (0.94 + rnd() * 0.12));
    reports.push({
      id: `seed-${key}-${i}`,
      deviceId: `trader-${hash(key + i) % 9973}`,
      origin: rnd() < 0.6 ? "deal" : "manual",
      side: i % 2 === 0 ? "sell" : "buy",
      commodityId,
      marketId,
      priceC,
      photo: rnd() < 0.2,
      status: screenReport(priceC, gov, null),
      at: now - Math.floor((0.2 + rnd() * 5.5) * DAY),
    });
  }
  return reports;
}

/** proven traders carry more weight than new phones */
export function seedReputation(deviceId: string): number {
  return 0.6 + (hash(deviceId) % 41) / 100;
}

const BUYERS = ["Posho mill", "Secondary school", "Hotel kitchen", "Wholesaler", "Cereal store", "Hospital kitchen", "Supermarket", "Food stall"];
const LOTS = [200, 300, 500, 800, 1000, 1500, 2000];
// Expanding the real market catalog must not make dozens of fictional buyers appear. Demo posts
// stay in a small, explicit set of markets and are separate from the 22 valid posting locations.
const DEMO_DEMAND_MARKETS = ["5671", "4626", "5666"];

/** demo account names, shaped like the ones app/lib/auth.ts would accept from a real trader */
const demoUsername = (buyer: string, marketId: string) =>
  `${buyer.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 10)}${(hash(buyer + marketId) % 90) + 10}`;

export function seedDemands(commodityId: string, now: number): Demand[] {
  const rnd = prng(`demand:${commodityId}`);
  const out: Demand[] = [];
  DEMO_DEMAND_MARKETS.forEach((marketId, marketIndex) => {
    const m = MARKETS.find((candidate) => candidate.id === marketId);
    if (!m) return;
    const local = govTodayC(commodityId, m.id);
    const count = 1 + ((hash(`${commodityId}:${marketId}`) + marketIndex) % 3);
    for (let i = 0; i < count; i++) {
      const buyer = BUYERS[(Math.floor(rnd() * BUYERS.length) + i) % BUYERS.length];
      out.push({
        id: `dm-${commodityId}-${m.id}-${i}`,
        username: demoUsername(`${buyer}-${i}`, m.id),
        buyer,
        phone: `0700 000 ${String(100 + ((hash(commodityId + m.id + i) + marketIndex) % 900))}`, // demo numbers only
        commodityId,
        marketId: m.id,
        kg: LOTS[Math.floor(rnd() * LOTS.length)],
        bidC: Math.round(local * (1.03 + rnd() * 0.1)),
        expiresAt: now + Math.floor((1 + rnd() * 5) * DAY),
        createdAt: now - Math.floor(rnd() * DAY),
      });
    }
  });
  return out;
}
