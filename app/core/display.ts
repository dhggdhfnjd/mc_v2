import { fmt, sayable, showPerKg, symbol } from "../lib/money";
import type { Currency } from "../lib/types";

/** Everything internal is KES; this turns it into what the trader sees (and back). */
export function display(cur: Currency, kesToUgx: number) {
  return {
    cur,
    sym: symbol(cur),
    /** KES cents per kg → text */
    perKg: (c: number) => showPerKg(c, cur, kesToUgx),
    /** whole KES → text in the display currency */
    amt: (kes: number) => fmt(cur === "KES" ? kes : sayable(kes * kesToUgx, "UGX")),
    /** whole KES → number in the display currency */
    num: (kes: number) => (cur === "KES" ? Math.round(kes) : sayable(kes * kesToUgx, "UGX")),
    /** a number typed in the display currency → whole KES */
    toKes: (typed: number) => (cur === "KES" ? typed : typed / kesToUgx),
  };
}

export const other = (cur: Currency): Currency => (cur === "KES" ? "UGX" : "KES");

export function ageText(days: number): string {
  if (days < 1) return "today";
  const d = Math.round(days);
  return d === 1 ? "1 day ago" : `${d} days ago`;
}
