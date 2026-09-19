// Shared domain types. Every price that crosses a module boundary is "KES cents per kg"
// (suffix C), so 53.9 KSh/kg is 5390. Whole-lot totals are whole currency units.

export type Currency = "KES" | "UGX";
export type Side = "sell" | "buy";
export type Country = "KE" | "UG";

export interface UnitDef {
  id: string;
  label: string; // full name in pickers: "bag 90kg"
  short: string; // after a number or a slash: "bag"
  kg: number; // kilograms in one unit
}

export interface Commodity {
  id: string;
  en: string;
  sw: string;
  icon: string;
  /** official wholesale price at Busia KE, KES per kg (demo seed) */
  govKes: number;
  /** price factor per quality grade, grade 1 first */
  grades: number[];
  /** share of value lost per 100 km of transport */
  perish: number;
  /** 12 monthly price indices, 100 = yearly average */
  season: number[];
  units: UnitDef[];
  /** multiplier for Ugandan markets (produce that flows from Uganda is cheaper there) */
  ugFactor: number;
}

export interface Market {
  id: string;
  name: string;
  country: Country;
  currency: Currency;
  lat: number;
  lon: number;
  /** price level relative to Busia KE */
  mult: number;
  /** position on the 240x196 corridor map */
  x: number;
  y: number;
}

export type ReportOrigin = "deal" | "manual" | "bid";
export type ReportStatus = "accepted" | "quarantined" | "rejected";

export interface CrowdReport {
  id: string;
  deviceId: string;
  origin: ReportOrigin;
  side: Side;
  commodityId: string;
  marketId: string;
  /** grade-1 equivalent, KES cents per kg */
  priceC: number;
  photo: boolean;
  status: ReportStatus;
  /** epoch ms */
  at: number;
}

export interface CrowdStat {
  medianC: number;
  p25C: number;
  p75C: number;
  reports: number;
  reporters: number;
  latestAgeDays: number;
  /** 0 = too few reporters to show, 1–3 = bars */
  confidence: 0 | 1 | 2 | 3;
}

export interface Band {
  lowC: number;
  highC: number;
  refC: number;
  basis: "crowd" | "official";
}

export interface Deal {
  id: string;
  at: number;
  side: Side;
  commodityId: string;
  marketId: string;
  grade: number;
  unitId: string;
  qty: number;
  kg: number;
  /** what was actually agreed, KES cents per kg; null when the deal fell through */
  priceC: number | null;
  /** last offer on the table, KES cents per kg */
  offerC: number | null;
  /** market reference at the time, KES cents per kg */
  refC: number;
  totalKes: number;
  photo: boolean;
}

export interface Demand {
  id: string;
  buyer: string;
  phone: string;
  /** deals kept out of deals agreed, e.g. [9, 10] */
  kept: [number, number];
  commodityId: string;
  marketId: string;
  kg: number;
  /** KES cents per kg */
  bidC: number;
  /** epoch ms */
  expiresAt: number;
  mine?: boolean;
}
