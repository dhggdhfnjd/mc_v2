import type { Commodity, Market, UnitDef } from "./types";

// Seed catalog for the Busia corridor. Prices, unit weights and seasonal curves are DEMO values
// that stand in for KAMIS / WFP data until the ingest pipeline exists.

const KG: UnitDef = { id: "kg", label: "kg", short: "kg", kg: 1 };
const BAG90: UnitDef = { id: "bag90", label: "bag 90kg", short: "bag", kg: 90 };
const BAG50: UnitDef = { id: "bag50", label: "bag 50kg", short: "bag", kg: 50 };
const TIN2: UnitDef = { id: "goro", label: "gorogoro 2kg", short: "tin", kg: 2 };
const DEBE: UnitDef = { id: "debe", label: "debe 17kg", short: "debe", kg: 17 };
const CRATE: UnitDef = { id: "crate", label: "crate 64kg", short: "crate", kg: 64 };
const NET: UnitDef = { id: "net", label: "net 13kg", short: "net", kg: 13 };
const BUNCH: UnitDef = { id: "bunch", label: "bunch 20kg", short: "bunch", kg: 20 };

// Grain is cheapest right after the Aug–Oct harvest and dearest in the Mar–Jun lean season.
const GRAIN = [104, 108, 112, 118, 120, 116, 102, 90, 86, 88, 94, 100];
// Vegetables spike when heavy rains ruin the crop (Apr–May, Nov).
const VEG = [88, 86, 96, 116, 122, 104, 94, 90, 96, 102, 114, 98];
const ROOT = [98, 100, 104, 108, 110, 106, 100, 94, 92, 94, 96, 98];
const FLAT = [100, 101, 102, 103, 102, 101, 100, 99, 98, 98, 99, 100];

export const COMMODITIES: Commodity[] = [
  { id: "maize", en: "Maize", sw: "Mahindi", icon: "🌽", govKes: 52, grades: [1, 0.92, 0.8], perish: 0.004, season: GRAIN, units: [BAG90, KG, TIN2, DEBE], ugFactor: 0.9 },
  { id: "beans", en: "Beans", sw: "Maharagwe", icon: "🫘", govKes: 120, grades: [1, 0.93, 0.82], perish: 0.003, season: GRAIN, units: [BAG90, KG, TIN2, DEBE], ugFactor: 0.88 },
  { id: "tomato", en: "Tomato", sw: "Nyanya", icon: "🍅", govKes: 70, grades: [1, 0.85, 0.65], perish: 0.06, season: VEG, units: [CRATE, KG], ugFactor: 0.92 },
  { id: "onion", en: "Onion", sw: "Kitunguu", icon: "🧅", govKes: 85, grades: [1, 0.9, 0.75], perish: 0.015, season: VEG, units: [NET, KG], ugFactor: 1.04 },
  { id: "matooke", en: "Matooke", sw: "Matoke", icon: "🍌", govKes: 35, grades: [1, 0.88, 0.7], perish: 0.05, season: FLAT, units: [BUNCH, KG], ugFactor: 0.62 },
  { id: "potato", en: "Potato", sw: "Viazi", icon: "🥔", govKes: 55, grades: [1, 0.9, 0.78], perish: 0.012, season: ROOT, units: [BAG50, KG, DEBE], ugFactor: 0.95 },
  { id: "rice", en: "Rice", sw: "Mchele", icon: "🌾", govKes: 140, grades: [1, 0.94, 0.85], perish: 0.002, season: FLAT, units: [BAG50, KG, TIN2], ugFactor: 0.97 },
  { id: "cabbage", en: "Cabbage", sw: "Kabichi", icon: "🥬", govKes: 30, grades: [1, 0.85, 0.7], perish: 0.04, season: VEG, units: [KG, BAG50], ugFactor: 0.9 },
  { id: "omena", en: "Omena", sw: "Omena", icon: "🐟", govKes: 320, grades: [1, 0.9, 0.78], perish: 0.006, season: FLAT, units: [KG, TIN2, DEBE], ugFactor: 0.94 },
  { id: "gnuts", en: "Groundnuts", sw: "Njugu", icon: "🥜", govKes: 210, grades: [1, 0.92, 0.8], perish: 0.003, season: GRAIN, units: [KG, TIN2, BAG50], ugFactor: 0.86 },
  { id: "cassava", en: "Cassava", sw: "Muhogo", icon: "🍠", govKes: 28, grades: [1, 0.9, 0.75], perish: 0.03, season: ROOT, units: [BAG50, KG], ugFactor: 0.8 },
  { id: "millet", en: "Millet", sw: "Wimbi", icon: "🌿", govKes: 95, grades: [1, 0.93, 0.82], perish: 0.003, season: GRAIN, units: [KG, TIN2, BAG90], ugFactor: 0.85 },
  { id: "sorghum", en: "Sorghum", sw: "Mtama", icon: "🌱", govKes: 60, grades: [1, 0.93, 0.82], perish: 0.003, season: GRAIN, units: [KG, TIN2, BAG90], ugFactor: 0.87 },
  { id: "kale", en: "Sukuma", sw: "Sukuma wiki", icon: "🥗", govKes: 25, grades: [1, 0.85, 0.7], perish: 0.08, season: VEG, units: [KG, BAG50], ugFactor: 0.95 },
  { id: "melon", en: "Melon", sw: "Tikiti", icon: "🍉", govKes: 35, grades: [1, 0.88, 0.72], perish: 0.03, season: FLAT, units: [KG], ugFactor: 0.85 },
  { id: "banana", en: "Banana", sw: "Ndizi", icon: "🍌", govKes: 45, grades: [1, 0.88, 0.7], perish: 0.06, season: FLAT, units: [BUNCH, KG], ugFactor: 0.75 },
  { id: "ndengu", en: "Green grams", sw: "Ndengu", icon: "🫛", govKes: 150, grades: [1, 0.93, 0.82], perish: 0.003, season: GRAIN, units: [KG, TIN2, BAG90], ugFactor: 0.95 },
  { id: "pepper", en: "Pepper", sw: "Pilipili", icon: "🌶️", govKes: 110, grades: [1, 0.85, 0.68], perish: 0.05, season: VEG, units: [KG], ugFactor: 0.9 },
];

export const MARKETS: Market[] = [
  { id: "busia-ke", name: "Busia KE", country: "KE", currency: "KES", lat: 0.4608, lon: 34.1115, mult: 1, x: 120, y: 126 },
  { id: "bungoma", name: "Bungoma", country: "KE", currency: "KES", lat: 0.5635, lon: 34.5606, mult: 1.06, x: 154, y: 84 },
  { id: "kakamega", name: "Kakamega", country: "KE", currency: "KES", lat: 0.2827, lon: 34.7519, mult: 1.08, x: 182, y: 122 },
  { id: "kisumu", name: "Kisumu", country: "KE", currency: "KES", lat: -0.0917, lon: 34.768, mult: 1.14, x: 160, y: 170 },
  { id: "eldoret", name: "Eldoret", country: "KE", currency: "KES", lat: 0.5143, lon: 35.2698, mult: 1.04, x: 210, y: 48 },
  { id: "busia-ug", name: "Busia UG", country: "UG", currency: "UGX", lat: 0.466, lon: 34.09, mult: 0.94, x: 100, y: 126 },
  { id: "tororo", name: "Tororo", country: "UG", currency: "UGX", lat: 0.6928, lon: 34.181, mult: 0.91, x: 96, y: 90 },
  { id: "mbale", name: "Mbale", country: "UG", currency: "UGX", lat: 1.0827, lon: 34.175, mult: 0.89, x: 84, y: 46 },
  { id: "iganga", name: "Iganga", country: "UG", currency: "UGX", lat: 0.6092, lon: 33.4686, mult: 0.9, x: 64, y: 118 },
  { id: "jinja", name: "Jinja", country: "UG", currency: "UGX", lat: 0.4244, lon: 33.2041, mult: 0.95, x: 42, y: 140 },
  { id: "kampala", name: "Kampala", country: "UG", currency: "UGX", lat: 0.3476, lon: 32.5825, mult: 1.03, x: 20, y: 160 },
];

/** corridor roads drawn on the map, as chains of market ids */
export const ROADS: string[][] = [
  ["kampala", "jinja", "iganga", "busia-ug", "busia-ke", "bungoma", "eldoret"],
  ["busia-ke", "kakamega", "kisumu"],
  ["busia-ug", "tororo", "mbale"],
];

/** demo mid-market rate: 1 KES in UGX */
export const KES_TO_UGX = 28.4;
/** EAC Simplified Trade Regime threshold */
export const STR_LIMIT_USD = 2000;
export const USD_TO_KES = 129;

export const commodity = (id: string): Commodity => COMMODITIES.find((c) => c.id === id) ?? COMMODITIES[0];
export const market = (id: string): Market => MARKETS.find((m) => m.id === id) ?? MARKETS[0];

export function roadKm(a: Market, b: Market): number {
  if (a.id === b.id) return 0;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  const straight = 6371 * 2 * Math.asin(Math.sqrt(h));
  // roads wind; the twin Busia towns are a walk across the border post
  return Math.max(1, Math.round(straight * 1.3));
}

export interface RouteCost {
  km: number;
  crossesBorder: boolean;
  /** transport, KES cents per kg */
  transportC: number;
  /** border handling, KES cents per kg */
  borderC: number;
  /** share of the load lost on the way */
  lossRate: number;
}

export function routeCost(fromId: string, toId: string, commodityId: string): RouteCost {
  const a = market(fromId);
  const b = market(toId);
  const km = roadKm(a, b);
  const crossesBorder = a.country !== b.country;
  return {
    km,
    crossesBorder,
    transportC: km === 0 ? 0 : Math.round(60 + km * 3.5),
    borderC: crossesBorder ? 100 : 0,
    lossRate: Math.min(0.25, (commodity(commodityId).perish * km) / 100),
  };
}
