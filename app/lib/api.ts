// API client. Every function mirrors one REST endpoint of the planned Workers backend
// (see docs/ARCHITECTURE.md §11). In this prototype the "server" runs in-process over seeded
// data plus whatever this phone has written to localStorage, but callers only ever see Promises,
// so swapping in `fetch(API_BASE + …)` later does not touch a single screen.

import { hashPassword, newSalt, newToken, normalizeUsername, validatePassword, validateUsername, verifyPassword, type AuthCode } from "./auth";
import { COMMODITIES, MARKETS, commodity, market, routeCost } from "./catalog";
import { netPriceC } from "./money";
import { validateDemand, type DemandInput } from "./demand";
import { seedDemands } from "./seed";
import type { Account, Demand, Session } from "./types";
import { wfpSeries } from "./wfp";

const DAY = 86_400_000;
const KEY = "mz.v2.";
const VALID_MARKET_IDS = new Set(MARKETS.map((m) => m.id));

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

export class ApiError extends Error {
  /** an AuthCode or "netError": the screen translates it instead of printing this message */
  constructor(message: string, readonly code?: AuthCode | "badPost" | "netError") {
    super(message);
  }
}

async function call<T>(fn: () => T | Promise<T>): Promise<T> {
  if (network === "down" || (network === "flaky" && Math.random() < 0.5)) {
    throw new ApiError("Network problem");
  }
  return fn();
}

// ---------- accounts ----------
// With NEXT_PUBLIC_API_BASE set, these calls (and the buyer posts below) are the Cloudflare Worker
// in worker/ and the
// account lives in the D1 `users` table, so the same name works on any handset. Without it the
// same schema is kept in this phone's own storage, which is what a judge sees in an offline demo
// and what the unit tests run against.

const API_BASE = (process.env.NEXT_PUBLIC_API_BASE ?? "").replace(/\/+$/, "");
export const usingRemoteAccounts = () => API_BASE !== "";

const SESSION_KEY = "session";
const USERS_KEY = "users"; // mirrors worker/schema.sql `users`, keyed by the primary key
const SESSION_DAYS = 30;

/** The signed-in account, read straight from storage: the session provider needs it synchronously. */
export function currentSession(): Session | null {
  const s = read<Session | null>(SESSION_KEY, null);
  if (!s) return null;
  if (s.expiresAt <= Date.now()) {
    write<Session | null>(SESSION_KEY, null);
    return null;
  }
  return s;
}

async function callApi(path: string, init: RequestInit): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(API_BASE + path, { ...init, headers: { "Content-Type": "application/json", ...(init.headers ?? {}) } });
  } catch {
    throw new ApiError("Network problem", "netError");
  }
  if (res.status === 204) return null;
  const data = (await res.json().catch(() => ({}))) as { error?: AuthCode | "badPost" };
  if (!res.ok) throw new ApiError(data.error ?? "Network problem", data.error ?? "netError");
  return data;
}

const users = () => read<Record<string, Account>>(USERS_KEY, {});

async function localRegister(rawName: string, password: string): Promise<Session> {
  const bad = validateUsername(rawName) ?? validatePassword(password);
  if (bad) throw new ApiError(bad, bad);
  const username = normalizeUsername(rawName);
  const table = users();
  if (table[username]) throw new ApiError("userTaken", "userTaken");
  const salt = newSalt();
  table[username] = { username, password: await hashPassword(password, salt), salt, createdAt: Date.now() };
  write(USERS_KEY, table);
  return startLocalSession(username);
}

async function localLogin(rawName: string, password: string): Promise<Session> {
  const row = users()[normalizeUsername(rawName)];
  // one answer for an unknown name and a wrong password, exactly like the Worker
  if (!row || !(await verifyPassword(password, row.salt, row.password))) {
    throw new ApiError("wrongLogin", "wrongLogin");
  }
  return startLocalSession(row.username);
}

function startLocalSession(username: string): Session {
  const session: Session = { username, token: newToken(), expiresAt: Date.now() + SESSION_DAYS * DAY };
  write(SESSION_KEY, session);
  return session;
}

/** POST /v1/auth/register */
export async function register(username: string, password: string): Promise<Session> {
  if (!usingRemoteAccounts()) return localRegister(username, password);
  // fail on the phone before spending a request on something the server will reject anyway
  const bad = validateUsername(username) ?? validatePassword(password);
  if (bad) throw new ApiError(bad, bad);
  const session = (await callApi("/v1/auth/register", { method: "POST", body: JSON.stringify({ username: normalizeUsername(username), password }) })) as Session;
  write(SESSION_KEY, session);
  return session;
}

/** POST /v1/auth/login */
export async function login(username: string, password: string): Promise<Session> {
  if (!usingRemoteAccounts()) return localLogin(username, password);
  const session = (await callApi("/v1/auth/login", { method: "POST", body: JSON.stringify({ username: normalizeUsername(username), password }) })) as Session;
  write(SESSION_KEY, session);
  return session;
}

/** POST /v1/auth/logout — the phone forgets the token whatever the server says. */
export async function logout(): Promise<void> {
  const session = currentSession();
  write<Session | null>(SESSION_KEY, null);
  if (session && usingRemoteAccounts()) {
    await callApi("/v1/auth/logout", { method: "POST", headers: { Authorization: `Bearer ${session.token}` } }).catch(() => undefined);
  }
}

// ---------- reads ----------
export interface PriceBundle {
  commodityId: string;
  marketId: string;
  /** Normalized WFP price, KES cents per kg. */
  priceC: number;
  /** Original source price and package, shown together for transparency. */
  packagePriceKes: number;
  unitLabel: string;
  unitKg: number;
  source: string;
  priceType: "Wholesale";
  priceFlag: "actual";
  observedAt: number;
  old: boolean;
  previousAt: number | null;
  previousPriceC: number | null;
  changeSincePrevious: number | null;
  yearAgoAt: number | null;
  yearAgoPriceC: number | null;
  changeSinceYearAgo: number | null;
  fetchedAt: number;
}

const sourceAt = (date: string) => Date.parse(`${date}T00:00:00Z`);
const normalizedC = (packagePriceKes: number, unitKg: number) => Math.round((packagePriceKes * 100) / unitKg);

function bundle(commodityId: string, now: number): PriceBundle {
  const series = wfpSeries(commodityId);
  const latest = series.observations.at(-1)!;
  const previous = series.observations.at(-2) ?? null;
  const observedAt = sourceAt(latest.date);
  const priceC = normalizedC(latest.packagePriceKes, series.unitKg);
  const previousPriceC = previous ? normalizedC(previous.packagePriceKes, series.unitKg) : null;
  const latestDate = new Date(observedAt);
  const yearAgoDate = `${latestDate.getUTCFullYear() - 1}-${String(latestDate.getUTCMonth() + 1).padStart(2, "0")}-${String(latestDate.getUTCDate()).padStart(2, "0")}`;
  const yearAgo = series.observations.find((x) => x.date === yearAgoDate) ?? null;
  const yearAgoPriceC = yearAgo ? normalizedC(yearAgo.packagePriceKes, series.unitKg) : null;
  return {
    commodityId,
    marketId: series.marketId,
    priceC,
    packagePriceKes: latest.packagePriceKes,
    unitLabel: series.unitLabel,
    unitKg: series.unitKg,
    source: "WFP",
    priceType: series.priceType,
    priceFlag: series.priceFlag,
    observedAt,
    old: now - observedAt > 90 * DAY,
    previousAt: previous ? sourceAt(previous.date) : null,
    previousPriceC,
    changeSincePrevious: previousPriceC ? priceC / previousPriceC - 1 : null,
    yearAgoAt: yearAgo ? sourceAt(yearAgo.date) : null,
    yearAgoPriceC,
    changeSinceYearAgo: yearAgoPriceC ? priceC / yearAgoPriceC - 1 : null,
    fetchedAt: now,
  };
}

/** Latest actual WFP wholesale observation at the selected highest-price market. */
export const getPrices = (commodityId: string) => call(() => bundle(commodityId, Date.now()));

export interface HistoryData {
  /** One slot per calendar month; null means WFP has no observation for that month. */
  points: (number | null)[];
  minC: number;
  maxC: number;
  avgC: number;
  nowC: number;
  change: number;
  fromAt: number;
  toAt: number;
  observations: number;
  expectedMonths: number;
  marketId: string;
  yearAgoAt: number | null;
  changeSinceYearAgo: number | null;
}

const monthKey = (at: number) => {
  const d = new Date(at);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

function historyOf(commodityId: string, months: number): HistoryData {
  const series = wfpSeries(commodityId);
  const latest = series.observations.at(-1)!;
  const latestAt = sourceAt(latest.date);
  const end = new Date(latestAt);
  const firstMonth = Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - months + 1, 15);
  const actual = series.observations
    .map((x) => ({ at: sourceAt(x.date), priceC: normalizedC(x.packagePriceKes, series.unitKg) }))
    .filter((x) => x.at >= firstMonth && x.at <= latestAt);
  const byMonth = new Map(actual.map((x) => [monthKey(x.at), x.priceC]));
  const points: (number | null)[] = [];
  for (let i = 0; i < months; i++) {
    const at = Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - months + 1 + i, 15);
    points.push(byMonth.get(monthKey(at)) ?? null);
  }
  const values = actual.map((x) => x.priceC);
  const first = values[0];
  const last = values[values.length - 1];
  const yearAgoAt = Date.UTC(end.getUTCFullYear() - 1, end.getUTCMonth(), end.getUTCDate());
  const yearAgoPriceC = series.observations
    .map((x) => ({ at: sourceAt(x.date), priceC: normalizedC(x.packagePriceKes, series.unitKg) }))
    .find((x) => x.at === yearAgoAt)?.priceC ?? null;
  return {
    points,
    minC: Math.min(...values),
    maxC: Math.max(...values),
    avgC: Math.round(values.reduce((s, v) => s + v, 0) / values.length),
    nowC: last,
    change: first > 0 ? last / first - 1 : 0,
    fromAt: firstMonth,
    toAt: latestAt,
    observations: values.length,
    expectedMonths: months,
    marketId: series.marketId,
    yearAgoAt: yearAgoPriceC === null ? null : yearAgoAt,
    changeSinceYearAgo: yearAgoPriceC ? last / yearAgoPriceC - 1 : null,
  };
}

/** Monthly WFP history; missing months remain null instead of being interpolated. */
export const getHistory = (commodityId: string, months: number) => call(() => historyOf(commodityId, months));

function localDemands(commodityId: string): Demand[] {
  return read<Demand[]>("demands", [])
    // Old demo releases used invented border markets. Never place those posts at a fallback
    // coordinate: only posts tied to one of the actual WFP markets may reach the map.
    .filter((d) => d.commodityId === commodityId && VALID_MARKET_IDS.has(d.marketId))
    // posts written before accounts existed still have to render
    .map((d) => ({ ...d, username: d.username || currentSession()?.username || "me" }));
}

const bearer = (session: Session) => ({ Authorization: `Bearer ${session.token}` });

/** The server has no notion of "mine"; it is whoever is signed in on this handset. */
const own = (d: Demand): Demand => ({ ...d, mine: d.username === currentSession()?.username });

async function remoteDemands(commodityId: string): Promise<Demand[]> {
  const { demands } = (await callApi(`/v1/demands?c=${encodeURIComponent(commodityId)}`, { method: "GET" })) as { demands: Demand[] };
  return demands.filter((d) => VALID_MARKET_IDS.has(d.marketId)).map(own);
}

/** Real posts (the Worker, or this handset's store offline) plus the labelled demo buyers. */
async function openDemands(commodityId: string, now: number): Promise<Demand[]> {
  const real = usingRemoteAccounts() ? await remoteDemands(commodityId) : localDemands(commodityId);
  return [...real, ...seedDemands(commodityId, now)].filter((d) => d.expiresAt > now);
}

export interface DemandView extends Demand {
  netC: number;
  km: number;
  crossesBorder: boolean;
  transportC: number;
  rank: number;
}

async function demandsOf(commodityId: string, fromId: string): Promise<DemandView[]> {
  const now = Date.now();
  return (await openDemands(commodityId, now))
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

/** GET /v1/demands?c — ranked here by what the seller really keeps, not by the headline bid */
export const getDemands = (commodityId: string, fromId: string) =>
  call(() => demandsOf(commodityId, fromId));

// ---------- buyer posts ----------
/** GET /v1/demands/mine?c */
export const getMyDemand = (commodityId: string) =>
  call(async () => {
    const session = currentSession();
    if (usingRemoteAccounts()) {
      if (!session) return null;
      const { demand } = (await callApi(`/v1/demands/mine?c=${encodeURIComponent(commodityId)}`, { method: "GET", headers: bearer(session) })) as { demand: Demand | null };
      return demand && own(demand);
    }
    return read<Demand[]>("demands", []).find((d) => d.commodityId === commodityId && VALID_MARKET_IDS.has(d.marketId) && d.expiresAt > Date.now()) ?? null;
  });

/** POST /v1/demands — one active post per commodity. Re-posting edits and renews it for three days. */
export const postDemand = (input: DemandInput) =>
  call(async () => {
    const session = currentSession();
    // a post is signed: the map shows who is buying, so there is no such thing as an anonymous one
    if (!session) throw new ApiError("needSignIn", "needSignIn");
    const bad = validateDemand(input);
    if (bad) throw new ApiError(bad, bad);
    if (usingRemoteAccounts()) {
      const { demand } = (await callApi("/v1/demands", { method: "POST", headers: bearer(session), body: JSON.stringify(input) })) as { demand: Demand };
      return own(demand);
    }
    const now = Date.now();
    const existing = read<Demand[]>("demands", []);
    const old = existing.find((x) => x.commodityId === input.commodityId && x.mine);
    const d: Demand = {
      id: old?.id ?? `my-${now}`,
      username: session.username,
      buyer: "",
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

/** POST /v1/demands/close */
export const closeDemand = (id: string) =>
  call(async () => {
    const session = currentSession();
    if (usingRemoteAccounts()) {
      if (!session) throw new ApiError("needSignIn", "needSignIn");
      await callApi("/v1/demands/close", { method: "POST", headers: bearer(session), body: JSON.stringify({ id }) });
      return true;
    }
    write("demands", read<Demand[]>("demands", []).filter((d) => d.id !== id));
    return true;
  });

// ---------- last-good cache, used by the useApi hook when a call fails ----------
export const cacheGet = <T,>(key: string) => read<{ at: number; data: T } | null>("cache." + key, null);
export const cachePut = <T,>(key: string, data: T) => write("cache." + key, { at: Date.now(), data });

export { COMMODITIES, MARKETS, market, commodity };
