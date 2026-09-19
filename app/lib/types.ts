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
  /** Latest selected WFP wholesale price, KES per kg; also anchors demo buyer bids. */
  govKes: number;
  /** Kept for the existing buyer-post demo. WFP price screens do not infer grades. */
  grades: number[];
  /** share of value lost per 100 km of transport */
  perish: number;
  /** 12 monthly price indices, 100 = yearly average */
  season: number[];
  units: UnitDef[];
  /** Neutral for this Kenya-only WFP catalog; kept for the existing buyer-post demo. */
  ugFactor: number;
  /** Stable identifiers and labels from the WFP source file. */
  wfpId: number;
  sourceName: string;
  /** Market chosen as the maximum price on this commodity's latest observation date. */
  priceMarketId: string;
  /** Number of distinct source months, used to order the home catalog by completeness. */
  dataMonths: number;
  /** Whether the shipped image label table can recognize this item. */
  photo: boolean;
}

export interface Market {
  id: string;
  name: string;
  country: Country;
  currency: Currency;
  lat: number;
  lon: number;
  /** Demo buyer-post multiplier. WFP prices never use this value. */
  mult: number;
}

export type ReportOrigin = "deal" | "manual";
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

export interface Demand {
  id: string;
  /** the account that posted it — the identity shown on the buyer map */
  username: string;
  /** what kind of business the buyer is ("Hotel kitchen"), for context under the name */
  buyer: string;
  phone: string;
  commodityId: string;
  marketId: string;
  kg: number;
  /** KES cents per kg */
  bidC: number;
  /** epoch ms */
  expiresAt: number;
  createdAt: number;
  mine?: boolean;
}

/** One row of the `users` table (worker/schema.sql). `password` is a digest, never a password. */
export interface Account {
  username: string;
  password: string;
  salt: string;
  createdAt: number;
}

/** What the phone keeps after signing in: one row of `sessions`, minus the bits it cannot use. */
export interface Session {
  username: string;
  token: string;
  expiresAt: number;
}
