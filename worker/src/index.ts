// Mizani API — a Cloudflare Worker in front of a D1 (SQLite) database.
//
// No framework. Accounts: create, sign in, sign out, ask who it is. Buyer posts: list the open
// ones for a crop, read your own, publish or edit it, close it. Validation and hashing are
// imported from app/lib/auth.ts and app/lib/demand.ts, the same modules the browser uses, so
// there is exactly one definition of "a valid username", "a valid post" and one KDF.
//
// The password arrives in the request body, is hashed inside the handler, and is never logged,
// echoed, or written anywhere but as a digest. Errors are returned as one of the AuthCode names
// the phone already knows how to translate, so the API never sends English prose to a screen
// that may be running in Kiswahili.

import {
  hashPassword,
  newSalt,
  newToken,
  normalizeUsername,
  validatePassword,
  validateUsername,
  verifyPassword,
  type AuthCode,
} from "../../app/lib/auth";
import { MAX_DAYS, normalizePhone, validateDemand, type DemandInput } from "../../app/lib/demand";

export interface Env {
  DB: D1Database;
  ALLOWED_ORIGINS?: string;
}

interface UserRow {
  username: string;
  password: string;
  salt: string;
}

const SESSION_DAYS = 30;
const DAY = 86_400_000;

// ---------- responses ----------
function cors(request: Request, env: Env): Record<string, string> {
  const allowed = (env.ALLOWED_ORIGINS ?? "").split(",").map((o) => o.trim()).filter(Boolean);
  const origin = request.headers.get("Origin") ?? "";
  const ok = allowed.includes(origin);
  return {
    "Access-Control-Allow-Origin": ok ? origin : allowed[0] ?? "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

const json = (body: unknown, status: number, headers: Record<string, string>) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });

/** Every failure the phone can act on is one i18n code; the HTTP status is for the network layer. */
const fail = (code: AuthCode | "badPost", status: number, headers: Record<string, string>) => json({ error: code }, status, headers);

// ---------- helpers ----------
async function body(request: Request): Promise<{ username: string; password: string } | null> {
  try {
    const data = (await request.json()) as { username?: unknown; password?: unknown };
    if (typeof data.username !== "string" || typeof data.password !== "string") return null;
    return { username: data.username, password: data.password };
  } catch {
    return null;
  }
}

async function issueSession(env: Env, username: string) {
  const now = Date.now();
  const token = newToken();
  const expiresAt = now + SESSION_DAYS * DAY;
  await env.DB.prepare("INSERT INTO sessions (token, username, created_at, expires_at) VALUES (?, ?, ?, ?)")
    .bind(token, username, now, expiresAt)
    .run();
  // opportunistic housekeeping: no cron needed for a table this small
  await env.DB.prepare("DELETE FROM sessions WHERE expires_at < ?").bind(now).run();
  return { username, token, expiresAt };
}

async function whoIs(request: Request, env: Env): Promise<string | null> {
  const auth = request.headers.get("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return null;
  const row = await env.DB.prepare("SELECT username FROM sessions WHERE token = ? AND expires_at > ?")
    .bind(token, Date.now())
    .first<{ username: string }>();
  return row?.username ?? null;
}

// ---------- routes ----------
async function register(request: Request, env: Env, headers: Record<string, string>): Promise<Response> {
  const input = await body(request);
  if (!input) return fail("userInvalid", 400, headers);

  const bad = validateUsername(input.username) ?? validatePassword(input.password);
  if (bad) return fail(bad, 400, headers);

  const username = normalizeUsername(input.username);
  const salt = newSalt();
  const password = await hashPassword(input.password, salt);
  try {
    await env.DB.prepare("INSERT INTO users (username, password, salt, created_at) VALUES (?, ?, ?, ?)")
      .bind(username, password, salt, Date.now())
      .run();
  } catch (e) {
    // the PRIMARY KEY is what makes a name unique; we let SQLite be the judge of the race
    if (String(e).includes("UNIQUE") || String(e).includes("PRIMARY KEY")) return fail("userTaken", 409, headers);
    throw e;
  }
  return json(await issueSession(env, username), 201, headers);
}

async function login(request: Request, env: Env, headers: Record<string, string>): Promise<Response> {
  const input = await body(request);
  if (!input) return fail("wrongLogin", 401, headers);

  const username = normalizeUsername(input.username);
  const row = await env.DB.prepare("SELECT username, password, salt FROM users WHERE username = ?")
    .bind(username)
    .first<UserRow>();
  // one message for "no such user" and "wrong password": which one it was is not the caller's business
  if (!row || !(await verifyPassword(input.password, row.salt, row.password))) {
    return fail("wrongLogin", 401, headers);
  }
  return json(await issueSession(env, row.username), 200, headers);
}

async function logout(request: Request, env: Env, headers: Record<string, string>): Promise<Response> {
  const auth = request.headers.get("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (token) await env.DB.prepare("DELETE FROM sessions WHERE token = ?").bind(token).run();
  return new Response(null, { status: 204, headers });
}

async function me(request: Request, env: Env, headers: Record<string, string>): Promise<Response> {
  const username = await whoIs(request, env);
  return username ? json({ username }, 200, headers) : fail("needSignIn", 401, headers);
}

// ---------- buyer posts ----------
interface DemandRow {
  id: string;
  username: string;
  commodity_id: string;
  market_id: string;
  kg: number;
  bid_c: number;
  phone: string;
  created_at: number;
  expires_at: number;
}

/** the wire shape is app/lib/types.ts Demand; "buyer" (a business type) is only set on demo posts */
const toDemand = (r: DemandRow) => ({
  id: r.id,
  username: r.username,
  buyer: "",
  phone: r.phone,
  commodityId: r.commodity_id,
  marketId: r.market_id,
  kg: r.kg,
  bidC: r.bid_c,
  createdAt: r.created_at,
  expiresAt: r.expires_at,
});

/** A phone number is public for three days, then it is gone from the table, not just hidden. */
const sweep = (env: Env, now: number) => env.DB.prepare("DELETE FROM demands WHERE expires_at <= ?").bind(now).run();

async function listDemands(url: URL, env: Env, headers: Record<string, string>): Promise<Response> {
  const commodityId = url.searchParams.get("c") ?? "";
  const now = Date.now();
  await sweep(env, now);
  const { results } = await env.DB.prepare(
    "SELECT * FROM demands WHERE commodity_id = ? AND expires_at > ? ORDER BY created_at DESC LIMIT 200",
  )
    .bind(commodityId, now)
    .all<DemandRow>();
  return json({ demands: results.map(toDemand) }, 200, headers);
}

async function myDemand(request: Request, url: URL, env: Env, headers: Record<string, string>): Promise<Response> {
  const username = await whoIs(request, env);
  if (!username) return fail("needSignIn", 401, headers);
  const row = await env.DB.prepare("SELECT * FROM demands WHERE username = ? AND commodity_id = ? AND expires_at > ?")
    .bind(username, url.searchParams.get("c") ?? "", Date.now())
    .first<DemandRow>();
  return json({ demand: row ? toDemand(row) : null }, 200, headers);
}

async function postDemand(request: Request, env: Env, headers: Record<string, string>): Promise<Response> {
  const username = await whoIs(request, env);
  if (!username) return fail("needSignIn", 401, headers);
  let input: DemandInput;
  try {
    input = (await request.json()) as DemandInput;
  } catch {
    return fail("badPost", 400, headers);
  }
  if (!input || typeof input !== "object" || typeof input.phone !== "string" || validateDemand(input)) {
    return fail("badPost", 400, headers);
  }
  const now = Date.now();
  await sweep(env, now);
  // one post per account and crop: publishing again edits it and renews the three days, keeping
  // its id and first-published time
  const row = await env.DB.prepare(
    `INSERT INTO demands (id, username, commodity_id, market_id, kg, bid_c, phone, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT (username, commodity_id) DO UPDATE SET
       market_id = excluded.market_id, kg = excluded.kg, bid_c = excluded.bid_c,
       phone = excluded.phone, expires_at = excluded.expires_at
     RETURNING *`,
  )
    .bind(
      `d-${newToken().slice(0, 20)}`,
      username,
      input.commodityId,
      input.marketId,
      input.kg,
      input.bidC,
      normalizePhone(input.phone),
      now,
      now + Math.min(input.days, MAX_DAYS) * DAY,
    )
    .first<DemandRow>();
  return json({ demand: row && toDemand(row) }, 200, headers);
}

async function closeDemand(request: Request, env: Env, headers: Record<string, string>): Promise<Response> {
  const username = await whoIs(request, env);
  if (!username) return fail("needSignIn", 401, headers);
  const data = (await request.json().catch(() => null)) as { id?: unknown } | null;
  if (typeof data?.id !== "string") return fail("badPost", 400, headers);
  // the username in the WHERE is the authorisation: nobody can close someone else's post
  await env.DB.prepare("DELETE FROM demands WHERE id = ? AND username = ?").bind(data.id, username).run();
  return new Response(null, { status: 204, headers });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const headers = cors(request, env);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });

    const url = new URL(request.url);
    const { pathname } = url;
    const post = request.method === "POST";
    try {
      if (pathname === "/health") return json({ ok: true }, 200, headers);
      if (pathname === "/v1/auth/register" && post) return await register(request, env, headers);
      if (pathname === "/v1/auth/login" && post) return await login(request, env, headers);
      if (pathname === "/v1/auth/logout" && post) return await logout(request, env, headers);
      if (pathname === "/v1/auth/me" && request.method === "GET") return await me(request, env, headers);
      if (pathname === "/v1/demands" && request.method === "GET") return await listDemands(url, env, headers);
      if (pathname === "/v1/demands/mine" && request.method === "GET") return await myDemand(request, url, env, headers);
      if (pathname === "/v1/demands" && post) return await postDemand(request, env, headers);
      if (pathname === "/v1/demands/close" && post) return await closeDemand(request, env, headers);
      return json({ error: "not_found" }, 404, headers);
    } catch (e) {
      // never let a driver message reach the handset; the phone shows its own "no connection"
      console.error("mizani-api", pathname, e instanceof Error ? e.message : e);
      return json({ error: "server_error" }, 500, headers);
    }
  },
};
