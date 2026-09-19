// Mizani account API — a Cloudflare Worker in front of a D1 (SQLite) database.
//
// Four routes, no framework: the widget only needs to create an account, sign in, sign out and
// ask who it is. Validation and hashing are imported from app/lib/auth.ts, the same module the
// browser uses, so there is exactly one definition of "a valid username" and one KDF.
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

/** Every failure the phone can act on is one AuthCode; the HTTP status is for the network layer. */
const fail = (code: AuthCode, status: number, headers: Record<string, string>) => json({ error: code }, status, headers);

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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const headers = cors(request, env);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });

    const { pathname } = new URL(request.url);
    const post = request.method === "POST";
    try {
      if (pathname === "/health") return json({ ok: true }, 200, headers);
      if (pathname === "/v1/auth/register" && post) return await register(request, env, headers);
      if (pathname === "/v1/auth/login" && post) return await login(request, env, headers);
      if (pathname === "/v1/auth/logout" && post) return await logout(request, env, headers);
      if (pathname === "/v1/auth/me" && request.method === "GET") return await me(request, env, headers);
      return json({ error: "not_found" }, 404, headers);
    } catch (e) {
      // never let a driver message reach the handset; the phone shows its own "no connection"
      console.error("mizani-api", pathname, e instanceof Error ? e.message : e);
      return json({ error: "server_error" }, 500, headers);
    }
  },
};
