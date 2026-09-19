// API client. Every function mirrors one REST endpoint of the planned Workers backend
// (see docs/ARCHITECTURE.md §11). In this prototype the "server" runs in-process over seeded
// data plus whatever this phone has written to localStorage, but callers only ever see Promises,
// so swapping in `fetch(API_BASE + …)` later does not touch a single screen.

import { COMMODITIES, KES_TO_UGX, MARKETS, commodity, market, routeCost } from "./catalog";
import { fairBand, netPriceC } from "./money";
import { officialMeta, officialSeries, seedDemands, seedReports, seedReputation } from "./seed";
import { aggregate } from "./trust";
import type { Band, CrowdReport, CrowdStat, Demand } from "./types";

const DAY = 86_400_000;
const KEY = "mz.v2.";

// ---------- tiny persistence layer (works without localStorage: tests, private mode) ----------
const memory = new Map<string, string>();
function read<T>(key: string, fallback: T): T {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(KEY + key) : memory.get(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write<T>(key: string, value: T): void {
  const raw = JSON.stringify(value);
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(KEY + key, raw);
    else memory.set(key, raw);
  } catch {
    memory.set(key, raw); // storage full or blocked: keep working for this session
  }
}

// ---------- simulated network, so error handling can be demonstrated ----------
export type NetworkMode = "ok" | "flaky" | "down";
let network: NetworkMode = "ok";
export const setNetwork = (mode: NetworkMode) => void (network = mode);
export const getNetwork = () => network;

export class ApiError extends Error {}

async function call<T>(fn: () => T): Promise<T> {
  if (network === "down" || (network === "flaky" && Math.random() < 0.5)) {
    throw new ApiError("Network problem");
  }
  return fn();
}

// ---------- reads ----------
export interface PriceBundle {
  commodityId: string;
  marketId: string;
  govC: number;
  source: string;
  officialAt: number;
  officialOld: boolean;
  crowd: CrowdStat | null;
  band: Band;
  trend7: number;
  vol30: number;
  kesToUgx: number;
  fetchedAt: number;
}

function allReports(commodityId: string, marketId: string, now: number): CrowdReport[] {
  return seedReports(commodityId, marketId, now);
}

function crowdStat(commodityId: string, marketId: string, now: number): CrowdStat | null {
  return aggregate(allReports(commodityId, marketId, now), now, seedReputation);
}

function bundle(commodityId: string, marketId: string, grade: number, now: number): PriceBundle {
  const series = officialSeries(commodityId, marketId, 31, now);
  const mean = series.reduce((s, v) => s + v, 0) / series.length;
  const vol30 = Math.sqrt(series.reduce((s, v) => s + (v - mean) ** 2, 0) / series.length) / mean;
  const meta = officialMeta(marketId, now);
  const officialOld = now - meta.at > 3 * DAY;
  const crowd = crowdStat(commodityId, marketId, now);
  const govC = series[0];
  const factor = commodity(commodityId).grades[grade] ?? 1;
  return {
    commodityId,
    marketId,
    govC: Math.round(govC * factor),
    source: meta.source,
    officialAt: meta.at,
    officialOld,
    crowd: crowd && {
      ...crowd,
      medianC: Math.round(crowd.medianC * factor),
      p25C: Math.round(crowd.p25C * factor),
      p75C: Math.round(crowd.p75C * factor),
    },
    // stale official data deserves a wider range
    band: fairBand(govC, crowd, officialOld ? Math.max(vol30, 0.08) : vol30, factor),
    trend7: series[7] > 0 ? series[0] / series[7] - 1 : 0,
    vol30,
    kesToUgx: KES_TO_UGX,
    fetchedAt: now,
  };
}

/** GET /v1/prices?c&m&g — one call feeds the price, calculator and show-card screens */
export const getPrices = (commodityId: string, marketId: string, grade = 0) =>
  call(() => bundle(commodityId, marketId, grade, Date.now()));

export interface HistoryData {
  points: number[]; // oldest → newest, at most 24
  minC: number;
  maxC: number;
  avgC: number;
  nowC: number;
  change: number;
}

function historyOf(commodityId: string, marketId: string, days: number): HistoryData {
  {
    const series = officialSeries(commodityId, marketId, days + 1, Date.now()).reverse();
    const bucket = Math.max(1, Math.ceil(series.length / 24));
    const points: number[] = [];
    for (let i = 0; i < series.length; i += bucket) {
      const slice = series.slice(i, i + bucket);
      points.push(Math.round(slice.reduce((s, v) => s + v, 0) / slice.length));
    }
    points[points.length - 1] = series[series.length - 1];
    return {
      points,
      minC: Math.min(...series),
      maxC: Math.max(...series),
      avgC: Math.round(series.reduce((s, v) => s + v, 0) / series.length),
      nowC: series[series.length - 1],
      change: series[series.length - 1] / series[0] - 1,
    };
  }
}

/** GET /v1/trends/history?c&m&range — downsampled: a 240 px screen cannot show more */
export const getHistory = (commodityId: string, marketId: string, days: number) =>
  call(() => historyOf(commodityId, marketId, days));

function openDemands(commodityId: string, now: number): Demand[] {
  const mine = read<Demand[]>("demands", []).filter((d) => d.commodityId === commodityId);
  return [...mine, ...seedDemands(commodityId, now)].filter((d) => d.expiresAt > now);
}

export interface DemandView extends Demand {
  netC: number;
  km: number;
  crossesBorder: boolean;
  transportC: number;
  rank: number;
}

function demandsOf(commodityId: string, fromId: string): DemandView[] {
  {
    const now = Date.now();
    return openDemands(commodityId, now)
      .map((d) => {
        const r = routeCost(fromId, d.marketId, commodityId);
        return {
          ...d,
          netC: netPriceC(d.bidC, r.transportC, r.borderC, r.lossRate),
          km: r.km,
          crossesBorder: r.crossesBorder,
          transportC: r.transportC + r.borderC,
          rank: 0,
        };
      })
      .sort((a, b) => b.netC - a.netC)
      .map((d, i) => ({ ...d, rank: i + 1 }));
  }
}

/** GET /v1/demands?c&from — ranked by what the seller really keeps, not by the headline bid */
export const getDemands = (commodityId: string, fromId: string) =>
  call(() => demandsOf(commodityId, fromId));

// ---------- buyer posts ----------
export const getMyDemand = (commodityId: string) =>
  call(() => read<Demand[]>("demands", []).find((d) => d.commodityId === commodityId && d.expiresAt > Date.now()) ?? null);

/** One active post per commodity. Re-posting edits and renews it for three days. */
export const postDemand = (input: { commodityId: string; marketId: string; kg: number; bidC: number; days: number; phone: string }) =>
  call(() => {
    const now = Date.now();
    const existing = read<Demand[]>("demands", []);
    const old = existing.find((x) => x.commodityId === input.commodityId && x.mine);
    const d: Demand = {
      id: old?.id ?? `my-${now}`,
      buyer: "You",
      phone: input.phone,
      commodityId: input.commodityId,
      marketId: input.marketId,
      kg: input.kg,
      bidC: input.bidC,
      expiresAt: now + input.days * DAY,
      createdAt: old?.createdAt ?? now,
      mine: true,
    };
    write("demands", [d, ...existing.filter((x) => x.id !== d.id && x.commodityId !== d.commodityId)].slice(0, 50));
    return d;
  });

export const closeDemand = (id: string) =>
  call(() => {
    write("demands", read<Demand[]>("demands", []).filter((d) => d.id !== id));
    return true;
  });

// ---------- last-good cache, used by the useApi hook when a call fails ----------
export const cacheGet = <T,>(key: string) => read<{ at: number; data: T } | null>("cache." + key, null);
export const cachePut = <T,>(key: string, data: T) => write("cache." + key, { at: Date.now(), data });

export { COMMODITIES, MARKETS, market, commodity };
