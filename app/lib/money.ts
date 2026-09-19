// The bargaining engine. Pure functions, integer math, no I/O — the same file can run in the
// widget (instant feedback while typing) and later in the API (validation).
// Convention: *C = KES cents per kg. Lot totals and unit prices are whole currency units.

import type { Band, CrowdStat, Currency, Side } from "./types";

export const toC = (perKg: number): number => Math.round(perKg * 100);
export const fromC = (c: number): number => c / 100;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** price of one trade unit (a 90 kg bag, a 2 kg gorogoro…) in whole KES */
export function unitPrice(perKgC: number, kgPerUnit: number): number {
  return Math.round((perKgC * kgPerUnit) / 100);
}

/** whole-lot value in whole KES */
export function lotTotal(perKgC: number, qty: number, kgPerUnit: number): number {
  return Math.round((perKgC * kgPerUnit * qty) / 100);
}

/** back from a quoted unit price (whole KES) to cents per kg */
export function perKgFromUnit(unitPriceKes: number, kgPerUnit: number): number {
  return kgPerUnit > 0 ? Math.round((unitPriceKes * 100) / kgPerUnit) : 0;
}

/**
 * Fair range. The official price is the anchor (team decision D14): crowd quartiles may refine
 * the range only inside ±20% of it, and only when enough independent traders reported.
 */
export function fairBand(govC: number, crowd: CrowdStat | null, vol30: number, gradeFactor = 1): Band {
  let lowC: number;
  let highC: number;
  let refC: number;
  let basis: Band["basis"];
  if (crowd && crowd.confidence >= 2) {
    lowC = clamp(crowd.p25C, govC * 0.8, govC * 1.2);
    highC = clamp(crowd.p75C, govC * 0.8, govC * 1.2);
    refC = clamp(crowd.medianC, lowC, highC);
    // never collapse to a single price: keep at least ±2% around the reference
    lowC = Math.min(lowC, refC * 0.98);
    highC = Math.max(highC, refC * 1.02);
    basis = "crowd";
  } else {
    const v = clamp(vol30, 0.05, 0.15);
    lowC = govC * (1 - v);
    highC = govC * (1 + v);
    refC = govC;
    basis = "official";
  }
  return {
    lowC: Math.round(lowC * gradeFactor),
    highC: Math.round(highC * gradeFactor),
    refC: Math.round(refC * gradeFactor),
    basis,
  };
}

export type Verdict = "good" | "fair" | "bad";

/** Judge the other party's offer from the user's side of the table. */
export function judge(side: Side, offerC: number, band: Band): Verdict {
  if (side === "sell") {
    if (offerC >= band.refC) return "good";
    return offerC >= band.lowC ? "fair" : "bad";
  }
  if (offerC <= band.refC) return "good";
  return offerC <= band.highC ? "fair" : "bad";
}

/** Money gained (+) or lost (−) on the whole lot versus the market reference, whole KES. */
export function lotDelta(side: Side, offerC: number, refC: number, kg: number): number {
  const diff = side === "sell" ? offerC - refC : refC - offerC;
  return Math.round((diff * kg) / 100);
}

/**
 * Next price to say out loud — reciprocal concession, no memory needed. Open a little beyond
 * the far edge of the fair range; then give ground only in proportion to how far the other
 * side has come from a lowball towards the fair price, so the two meet at the market
 * reference. A lowball earns no concession at all. Never cross the user's own limit (cost
 * floor when selling, budget ceiling when buying). Pass offerC = 0 for the opening price.
 */
export function counterOffer(side: Side, offerC: number, band: Band, limitC: number | null): number {
  if (side === "sell") {
    const floor = Math.max(limitC ?? 0, band.lowC);
    const open = Math.max(Math.round(band.highC * 1.03), floor);
    const settle = Math.max(band.refC, floor);
    const lowball = band.lowC * 0.85;
    const progress = clamp((offerC - lowball) / (settle - lowball), 0, 1);
    const ask = Math.round(open - (open - settle) * progress);
    return Math.max(floor, offerC >= ask ? offerC : ask); // they reached us: take it
  }
  const ceil = Math.min(limitC ?? Number.MAX_SAFE_INTEGER, band.highC);
  const open = Math.min(Math.round(band.lowC * 0.97), ceil);
  const settle = Math.min(band.refC, ceil);
  const highball = band.highC * 1.15;
  const progress = offerC <= 0 ? 0 : clamp((highball - offerC) / (highball - settle), 0, 1);
  const bid = Math.round(open + (settle - open) * progress);
  return Math.min(ceil, offerC > 0 && offerC <= bid ? offerC : bid);
}

/** Round to a number a person would actually say at a market stall. */
export function sayable(amount: number, currency: Currency): number {
  const steps: [number, number][] =
    currency === "KES"
      ? [[2000, 50], [200, 10], [0, 1]]
      : [[20000, 500], [2000, 100], [0, 50]];
  const step = steps.find(([min]) => amount >= min)?.[1] ?? 1;
  return Math.round(amount / step) * step;
}

/** All-in cost per kg the seller must recover, KES cents. */
export function breakEvenC(costKes: number, kg: number, lossRate = 0): number {
  const sellable = kg * (1 - lossRate);
  return sellable > 0 ? Math.round((costKes * 100) / sellable) : 0;
}

/** What a bid is really worth after getting the goods there. */
export function netPriceC(bidC: number, transportC: number, borderC: number, lossRate: number): number {
  return Math.round(bidC - transportC - borderC - bidC * lossRate);
}

export function convert(amountKes: number, to: Currency, kesToUgx: number): number {
  return to === "KES" ? amountKes : Math.round(amountKes * kesToUgx);
}

/** How much a street exchange rate costs against the mid rate, in the target currency. */
export function fxLoss(amountKes: number, streetRate: number, midRate: number): { lost: number; pct: number } {
  const lost = Math.round(amountKes * (midRate - streetRate));
  return { lost, pct: midRate > 0 ? (midRate - streetRate) / midRate : 0 };
}

export function changeDue(paid: number, total: number): number {
  return Math.max(0, paid - total);
}

const GROUP = /\B(?=(\d{3})+(?!\d))/g;
export const fmt = (n: number): string => String(Math.round(n)).replace(GROUP, ",");
export const symbol = (c: Currency): string => (c === "KES" ? "KSh" : "USh");

/** cents-per-kg → display number in the chosen currency (one decimal for small KES prices) */
export function showPerKg(c: number, currency: Currency, kesToUgx: number): string {
  if (currency === "UGX") return fmt(sayable((c / 100) * kesToUgx, "UGX"));
  const v = c / 100;
  return v >= 100 || Number.isInteger(v) ? fmt(v) : v.toFixed(1);
}
