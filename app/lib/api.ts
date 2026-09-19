// API client. Every function mirrors one REST endpoint of the planned Workers backend
// (see docs/ARCHITECTURE.md §11). In this prototype the "server" runs in-process over seeded
// data plus whatever this phone has written to localStorage, but callers only ever see Promises,
// so swapping in `fetch(API_BASE + …)` later does not touch a single screen.

import { COMMODITIES, KES_TO_UGX, MARKETS, commodity, market, routeCost } from "./catalog";
import { fairBand, netPriceC } from "./money";
import { govTodayC, officialMeta, officialSeries, seedDeals, seedDemands, seedReports, seedReputation } from "./seed";
import { aggregate, screenReport } from "./trust";
import type { Band, CrowdReport, CrowdStat, Deal, Demand, ReportStatus, Side } from "./types";

const DAY = 86_400_000;
const KEY = "mz.v1.";

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

export function deviceId(): string {
  let id = read<string>("device", "");
  if (!id) {
    id = "me-" + Math.random().toString(36).slice(2, 10);
    write("device", id);
  }
  return id;
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

function reputationOf(id: string): number {
  return id === deviceId() ? read<number>("reputation", 0.3) : seedReputation(id);
}

function allReports(commodityId: string, marketId: string, now: number): CrowdReport[] {
  const mine = read<CrowdReport[]>("reports", []).filter((r) => r.commodityId === commodityId && r.marketId === marketId);
  return [...seedReports(commodityId, marketId, now), ...mine];
}

function crowdStat(commodityId: string, marketId: string, now: number): CrowdStat | null {
  return aggregate(allReports(commodityId, marketId, now), now, reputationOf);
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

export interface MarketOption {
  marketId: string;
  refC: number;
  netC: number;
  km: number;
  crossesBorder: boolean;
}

/** GET /v1/prices/compare?c&from — where else could I sell (or buy), after transport */
export const compareMarkets = (commodityId: string, fromId: string, side: Side) =>
  call(() => {
    const now = Date.now();
    return MARKETS.filter((m) => m.id !== fromId)
      .map((m): MarketOption => {
        const b = bundle(commodityId, m.id, 0, now);
        const r = routeCost(fromId, m.id, commodityId);
        const netC =
          side === "sell"
            ? netPriceC(b.band.refC, r.transportC, r.borderC, r.lossRate)
            : Math.round(b.band.refC * (1 + r.lossRate) + r.transportC + r.borderC);
        return { marketId: m.id, refC: b.band.refC, netC, km: r.km, crossesBorder: r.crossesBorder };
      })
      .sort((a, b) => (side === "sell" ? b.netC - a.netC : a.netC - b.netC));
  });

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

export interface SeasonData {
  index: number[];
  month: number;
  low: number[];
  high: number[];
  nowVsAvg: number;
  /** expected price change if the goods are stored 3 months, before storage loss */
  hold3: number;
}

/** GET /v1/trends/season?c&m */
export const getSeason = (commodityId: string) =>
  call((): SeasonData => {
    const index = commodity(commodityId).season;
    const month = new Date().getMonth();
    const sorted = [...index].sort((a, b) => a - b);
    return {
      index,
      month,
      low: index.map((v, i) => (v <= sorted[2] ? i : -1)).filter((i) => i >= 0),
      high: index.map((v, i) => (v >= sorted[9] ? i : -1)).filter((i) => i >= 0),
      nowVsAvg: index[month] / 100 - 1,
      hold3: index[(month + 3) % 12] / index[month] - 1,
    };
  });

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

export interface FoodDetail {
  price: PriceBundle;
  history: HistoryData;
  /** the buyer who leaves the seller the most after transport, or null when nobody is buying */
  best: DemandView | null;
  demands: number;
}

/** GET /v1/food?c&m — the three panels of the food detail view in the one call that screen gets */
export const getFoodDetail = (commodityId: string, marketId: string) =>
  call((): FoodDetail => {
    const list = demandsOf(commodityId, marketId);
    return {
      price: bundle(commodityId, marketId, 0, Date.now()),
      history: historyOf(commodityId, marketId, 30),
      best: list[0] ?? null,
      demands: list.length,
    };
  });

/** best open bid net of transport — the "or sell elsewhere" line on the bargaining screen */
export const bestAlternative = (commodityId: string, fromId: string) =>
  getDemands(commodityId, fromId).then((list) => list.find((d) => d.marketId !== fromId && !d.mine) ?? null);

// ---------- writes ----------
export interface ReportInput {
  commodityId: string;
  marketId: string;
  grade: number;
  side: Side;
  /** as typed by the user: KES cents per kg at the stated grade */
  priceC: number;
  photo?: boolean;
  origin?: CrowdReport["origin"];
}

function addReport(input: ReportInput, now: number): ReportStatus {
  const factor = commodity(input.commodityId).grades[input.grade] ?? 1;
  const gradeOne = Math.round(input.priceC / factor);
  const gov = govTodayC(input.commodityId, input.marketId);
  const current = crowdStat(input.commodityId, input.marketId, now);
  const status = screenReport(gradeOne, gov, current && current.confidence > 0 ? current.medianC : null);
  const reports = read<CrowdReport[]>("reports", []);
  reports.push({
    id: `r-${now}`,
    deviceId: deviceId(),
    origin: input.origin ?? "manual",
    side: input.side,
    commodityId: input.commodityId,
    marketId: input.marketId,
    priceC: gradeOne,
    photo: !!input.photo,
    status,
    at: now,
  });
  write("reports", reports.slice(-200));
  // behaviour-based reputation: honest reports slowly earn weight, refused ones lose it fast
  const rep = read<number>("reputation", 0.3);
  write("reputation", Math.min(1, Math.max(0.1, +(rep + (status === "accepted" ? 0.05 : status === "rejected" ? -0.15 : 0)).toFixed(2))));
  return status;
}

/** POST /v1/reports */
export const postReport = (input: ReportInput) => call(() => addReport(input, Date.now()));

/** POST /v1/deals — the ledger entry is saved first; the anonymous price report follows */
export const postDeal = (deal: Omit<Deal, "id" | "at">) =>
  call(() => {
    const now = Date.now();
    const saved: Deal = { ...deal, id: `d-${now}`, at: now };
    write("deals", [saved, ...read<Deal[]>("deals", [])].slice(0, 200));
    let status: ReportStatus | null = null;
    if (deal.priceC !== null) {
      status = addReport(
        { commodityId: deal.commodityId, marketId: deal.marketId, grade: deal.grade, side: deal.side, priceC: deal.priceC, photo: deal.photo, origin: "deal" },
        now,
      );
    }
    return { deal: saved, status };
  });

/** GET /v1/me/deals */
/** the trader's own deals, newest first, over the seeded book the demo ships with */
const allDeals = (): Deal[] =>
  [...read<Deal[]>("deals", []), ...seedDeals(Date.now())].sort((a, b) => b.at - a.at);

export const getDeals = () => call(allDeals);

export interface Summary {
  count: number;
  soldKes: number;
  boughtKes: number;
  /** average closed price against the market reference at the time; + is good for the user */
  vsMarket: number | null;
  stars: number;
}

/** GET /v1/me/summary?period=week */
export const getSummary = () =>
  call((): Summary => {
    const since = Date.now() - 7 * DAY;
    const deals = allDeals().filter((d) => d.at >= since && d.priceC !== null);
    const edge = deals.map((d) => (d.side === "sell" ? d.priceC! / d.refC - 1 : 1 - d.priceC! / d.refC));
    return {
      count: deals.length,
      soldKes: deals.filter((d) => d.side === "sell").reduce((s, d) => s + d.totalKes, 0),
      boughtKes: deals.filter((d) => d.side === "buy").reduce((s, d) => s + d.totalKes, 0),
      vsMarket: edge.length ? edge.reduce((s, v) => s + v, 0) / edge.length : null,
      stars: Math.round(read<number>("reputation", 0.3) * 5),
    };
  });

/** POST /v1/demands */
export const postDemand = (input: { commodityId: string; marketId: string; kg: number; bidC: number; days: number; phone: string }) =>
  call(() => {
    const now = Date.now();
    const d: Demand = {
      id: `my-${now}`,
      buyer: "You",
      phone: input.phone,
      kept: [0, 0],
      commodityId: input.commodityId,
      marketId: input.marketId,
      kg: input.kg,
      bidC: input.bidC,
      expiresAt: now + input.days * DAY,
      mine: true,
    };
    write("demands", [d, ...read<Demand[]>("demands", [])].slice(0, 50));
    // a posted bid is a (weak) price signal too
    addReport({ commodityId: d.commodityId, marketId: d.marketId, grade: 0, side: "buy", priceC: d.bidC, origin: "bid" }, now);
    return d;
  });

export function resetDemoData(): void {
  for (const k of ["reports", "deals", "demands", "reputation"]) {
    try {
      if (typeof localStorage !== "undefined") localStorage.removeItem(KEY + k);
    } catch {
      /* ignore */
    }
    memory.delete(k);
  }
}

// ---------- last-good cache, used by the useApi hook when a call fails ----------
export const cacheGet = <T,>(key: string) => read<{ at: number; data: T } | null>("cache." + key, null);
export const cachePut = <T,>(key: string, data: T) => write("cache." + key, { at: Date.now(), data });

export { COMMODITIES, MARKETS, market, commodity };
