// Account rules and password hashing. Shared code: the browser imports it for validation and for
// the offline demo store, and the Cloudflare Worker (worker/src/index.ts) imports the very same
// functions so a password is hashed exactly one way, in one place.
//
// A password is never stored, sent to a log, or kept in component state after the call that uses
// it. What the `users` table holds is the tagged digest built here.

/** every failure a screen has to explain; each name is also an i18n key */
export type AuthCode =
  | "userInvalid"
  | "userTaken"
  | "passShort"
  | "passMatch"
  | "wrongLogin"
  | "needSignIn";

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 16;
export const PASSWORD_MIN = 4;
export const PASSWORD_MAX = 32;

/** PBKDF2 rounds. Cheap enough for the cloud browser, dear enough to matter if the table leaks. */
const ROUNDS = 100_000;
const PBKDF2_TAG = "p1";
const FALLBACK_TAG = "x1";

/** Names are matched case-insensitively, so the stored form is the lowercased one. */
export const normalizeUsername = (raw: string): string => raw.trim().toLowerCase();

const USERNAME_RE = /^[a-z0-9][a-z0-9._-]*$/;

export function validateUsername(raw: string): AuthCode | null {
  const u = normalizeUsername(raw);
  if (u.length < USERNAME_MIN || u.length > USERNAME_MAX) return "userInvalid";
  return USERNAME_RE.test(u) ? null : "userInvalid";
}

export function validatePassword(password: string): AuthCode | null {
  if (password.length < PASSWORD_MIN || password.length > PASSWORD_MAX) return "passShort";
  return null;
}

// ---------- hashing ----------
const bytes = (s: string) => new TextEncoder().encode(s);
const hex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
// bare `crypto`, not globalThis.crypto: the Workers runtime declares the global but does not
// widen typeof globalThis, and this form typechecks in the browser, in Workers and in Node
const subtle = (): SubtleCrypto | null => (typeof crypto !== "undefined" && crypto.subtle ? crypto.subtle : null);

/** 16 random bytes; falls back to Math.random only where Web Crypto is missing entirely. */
export function newSalt(): string {
  const buf = new Uint8Array(16);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(buf);
  } else {
    for (let i = 0; i < buf.length; i++) buf[i] = Math.floor(Math.random() * 256);
  }
  return hex(buf.buffer);
}

async function pbkdf2(password: string, salt: string, api: SubtleCrypto): Promise<string> {
  const key = await api.importKey("raw", bytes(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await api.deriveBits({ name: "PBKDF2", salt: bytes(salt), iterations: ROUNDS, hash: "SHA-256" }, key, 256);
  return `${PBKDF2_TAG}$${ROUNDS}$${hex(bits)}`;
}

/**
 * Last resort for a runtime without Web Crypto (an old simulator, a page served over plain HTTP).
 * It is deliberately tagged differently: it is obfuscation, not a KDF, and a deployment that ever
 * writes one of these has a configuration problem worth seeing in the table.
 */
function fallbackHash(password: string, salt: string): string {
  const input = `${salt}:${password}`;
  const lanes = [0x811c9dc5, 0x01000193, 0x9e3779b9, 0x85ebca6b];
  for (let round = 0; round < 512; round++) {
    for (let i = 0; i < input.length; i++) {
      const c = input.charCodeAt(i) ^ round;
      for (let l = 0; l < lanes.length; l++) {
        lanes[l] = Math.imul(lanes[l] ^ c, 16_777_619) >>> 0;
        lanes[l] = ((lanes[l] << 13) | (lanes[l] >>> 19)) >>> 0;
      }
    }
  }
  return `${FALLBACK_TAG}$${lanes.map((l) => l.toString(16).padStart(8, "0")).join("")}`;
}

export async function hashPassword(password: string, salt: string): Promise<string> {
  const api = subtle();
  return api ? pbkdf2(password, salt, api) : fallbackHash(password, salt);
}

/** length-independent comparison, so a wrong password leaks nothing through timing */
function sameDigest(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  // charCodeAt past the end is NaN, which `|| 0` turns into a difference we still count
  for (let i = 0; i < n; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

export async function verifyPassword(password: string, salt: string, stored: string): Promise<boolean> {
  const api = subtle();
  const scheme = stored.split("$")[0];
  if (scheme === PBKDF2_TAG) {
    if (!api) return false; // stored by a runtime with Web Crypto, checked by one without: refuse
    const rounds = Number(stored.split("$")[1]) || ROUNDS;
    const key = await api.importKey("raw", bytes(password), "PBKDF2", false, ["deriveBits"]);
    const bits = await api.deriveBits({ name: "PBKDF2", salt: bytes(salt), iterations: rounds, hash: "SHA-256" }, key, 256);
    return sameDigest(`${PBKDF2_TAG}$${rounds}$${hex(bits)}`, stored);
  }
  return sameDigest(fallbackHash(password, salt), stored);
}

/** opaque session token for the sessions table */
export function newToken(): string {
  return `${newSalt()}${newSalt()}`;
}
