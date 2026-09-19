// Rules for a buyer post. Shared code, like auth.ts: the phone checks a post before spending a
// request on it, and the Worker (worker/src/index.ts) checks it again with these same functions,
// so there is one definition of "a valid post" on both sides of the wire.

import { COMMODITIES, MARKETS } from "./catalog";

/** A post is public for at most three days; the buyer reviews exactly that before publishing. */
export const MAX_DAYS = 3;
export const MAX_KG = 1_000_000;
/** KES cents per kg; far above any real bid, low enough to catch a slipped digit */
export const MAX_BID_C = 10_000_000;

export interface DemandInput {
  commodityId: string;
  marketId: string;
  kg: number;
  bidC: number;
  days: number;
  phone: string;
}

const COMMODITY_IDS = new Set(COMMODITIES.map((c) => c.id));
const MARKET_IDS = new Set(MARKETS.map((m) => m.id));

/** Digits, spaces and one leading +; 7–15 digits, the E.164 ceiling. */
export function normalizePhone(raw: string): string | null {
  const phone = raw.trim().replace(/\s+/g, " ");
  if (!/^\+?[0-9 ]+$/.test(phone)) return null;
  const digits = phone.replace(/\D/g, "").length;
  return digits >= 7 && digits <= 15 ? phone : null;
}

/** "badPost" is also an i18n key, so a rejected post prints in the phone's language. */
export function validateDemand(input: DemandInput): "badPost" | null {
  if (!COMMODITY_IDS.has(input.commodityId) || !MARKET_IDS.has(input.marketId)) return "badPost";
  if (!Number.isInteger(input.kg) || input.kg <= 0 || input.kg > MAX_KG) return "badPost";
  if (!Number.isInteger(input.bidC) || input.bidC <= 0 || input.bidC > MAX_BID_C) return "badPost";
  if (!Number.isInteger(input.days) || input.days < 1 || input.days > MAX_DAYS) return "badPost";
  return normalizePhone(input.phone) ? null : "badPost";
}
