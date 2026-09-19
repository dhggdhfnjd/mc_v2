import type { Commodity, Market, UnitDef } from "./types";

// The visible catalog is backed by actual WFP Kenya wholesale observations. Each commodity uses
// one fixed source package, so its history never mixes units. The first eight entries are the
// main home page (after Camera); the final three form page two.

const KG: UnitDef = { id: "kg", label: "1 kg", short: "kg", kg: 1 };
const BAG90: UnitDef = { id: "bag90", label: "90 kg bag", short: "90 kg", kg: 90 };
const BAG50: UnitDef = { id: "bag50", label: "50 kg bag", short: "50 kg", kg: 50 };
const CRATE64: UnitDef = { id: "crate64", label: "64 kg crate", short: "64 kg", kg: 64 };
const NET13: UnitDef = { id: "net13", label: "13 kg net", short: "13 kg", kg: 13 };
const BAG126: UnitDef = { id: "bag126", label: "126 kg bag", short: "126 kg", kg: 126 };
const FLAT = [100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100, 100];

export const COMMODITIES: Commodity[] = [
  { id: "maize", en: "Maize", sw: "Mahindi", icon: "🌽", govKes: 58.33, grades: [1], perish: 0.004, season: FLAT, units: [BAG90, KG], ugFactor: 1, wfpId: 440, sourceName: "Maize (white, dry)", priceMarketId: "5671", dataMonths: 66, photo: true },
  { id: "tomato", en: "Tomato", sw: "Nyanya", icon: "🍅", govKes: 184.28, grades: [1], perish: 0.06, season: FLAT, units: [CRATE64, KG], ugFactor: 1, wfpId: 114, sourceName: "Tomatoes", priceMarketId: "5671", dataMonths: 65, photo: true },
  { id: "potato", en: "Potato", sw: "Viazi", icon: "🥔", govKes: 91.6, grades: [1], perish: 0.012, season: FLAT, units: [BAG50, KG], ugFactor: 1, wfpId: 891, sourceName: "Potatoes (Irish, white)", priceMarketId: "5671", dataMonths: 64, photo: true },
  { id: "kale", en: "Kale", sw: "Sukuma wiki", icon: "🥬", govKes: 95.19, grades: [1], perish: 0.08, season: FLAT, units: [BAG50, KG], ugFactor: 1, wfpId: 796, sourceName: "Kale", priceMarketId: "5671", dataMonths: 61, photo: true },
  { id: "onion", en: "Onion", sw: "Kitunguu", icon: "🧅", govKes: 123.08, grades: [1], perish: 0.015, season: FLAT, units: [NET13, KG], ugFactor: 1, wfpId: 892, sourceName: "Onions (dry)", priceMarketId: "5671", dataMonths: 61, photo: true },
  { id: "cabbage", en: "Cabbage", sw: "Kabichi", icon: "🥬", govKes: 22.5, grades: [1], perish: 0.04, season: FLAT, units: [BAG126, KG], ugFactor: 1, wfpId: 181, sourceName: "Cabbage", priceMarketId: "5666", dataMonths: 57, photo: true },
  { id: "rice", en: "Rice", sw: "Mchele", icon: "🌾", govKes: 180, grades: [1], perish: 0.002, season: FLAT, units: [BAG50, KG], ugFactor: 1, wfpId: 894, sourceName: "Rice (aromatic)", priceMarketId: "4626", dataMonths: 50, photo: true },
  { id: "beans", en: "Beans", sw: "Maharagwe", icon: "🫘", govKes: 93.33, grades: [1], perish: 0.003, season: FLAT, units: [BAG90, KG], ugFactor: 1, wfpId: 897, sourceName: "Beans (rosecoco)", priceMarketId: "4626", dataMonths: 49, photo: true },
  { id: "cowpea", en: "Cowpeas", sw: "Kunde", icon: "🫛", govKes: 80, grades: [1], perish: 0.003, season: FLAT, units: [BAG90, KG], ugFactor: 1, wfpId: 218, sourceName: "Cowpeas", priceMarketId: "4626", dataMonths: 59, photo: true },
  { id: "red-potato", en: "Red potato", sw: "Viazi vyekundu", icon: "🥔", govKes: 60, grades: [1], perish: 0.012, season: FLAT, units: [BAG50, KG], ugFactor: 1, wfpId: 890, sourceName: "Potatoes (Irish, red)", priceMarketId: "5666", dataMonths: 53, photo: true },
  { id: "dolichos", en: "Dolichos beans", sw: "Njahi", icon: "🫘", govKes: 80, grades: [1], perish: 0.003, season: FLAT, units: [BAG90, KG], ugFactor: 1, wfpId: 896, sourceName: "Beans (dolichos)", priceMarketId: "4626", dataMonths: 50, photo: true },
];

// The 22 unique markets that contain at least one observation for the adopted commodities under
// the same fixed-unit, actual wholesale filters used by the price series. Map positions always
// use these WFP latitude/longitude values; the smaller price-market set lives in WFP_SERIES.
export const MARKETS: Market[] = [
  { id: "5671", name: "Kibuye (Kisumu)", country: "KE", currency: "KES", lat: -0.09, lon: 34.77, mult: 1 },
  { id: "5670", name: "Karatina (Nyeri)", country: "KE", currency: "KES", lat: -0.48, lon: 37.13, mult: 1 },
  { id: "5893", name: "Vanga (Kwale)", country: "KE", currency: "KES", lat: -4.66, lon: 39.22, mult: 1 },
  { id: "5672", name: "Kongowea (Mombasa)", country: "KE", currency: "KES", lat: -4.06, lon: 39.66, mult: 1 },
  { id: "187", name: "Kitui", country: "KE", currency: "KES", lat: -1.37, lon: 38.02, mult: 1 },
  { id: "5892", name: "Kitui town (Kitui)", country: "KE", currency: "KES", lat: -1.36, lon: 38.01, mult: 1 },
  { id: "5665", name: "Tala Centre Market (Machakos)", country: "KE", currency: "KES", lat: -1.27, lon: 37.32, mult: 1 },
  { id: "5666", name: "Kathonzweni (Makueni)", country: "KE", currency: "KES", lat: -1.91, lon: 37.73, mult: 1 },
  { id: "5667", name: "Makueni", country: "KE", currency: "KES", lat: -1.81, lon: 37.62, mult: 1 },
  { id: "6352", name: "Wote town (Makueni)", country: "KE", currency: "KES", lat: -1.79, lon: 37.63, mult: 1 },
  { id: "5668", name: "Kaanwa (Tharaka Nithi)", country: "KE", currency: "KES", lat: -0.32, lon: 37.72, mult: 1 },
  { id: "4626", name: "Kangemi (Nairobi)", country: "KE", currency: "KES", lat: -1.27, lon: 36.74, mult: 1 },
  { id: "5697", name: "Kitengela (Kajiado)", country: "KE", currency: "KES", lat: -1.29, lon: 36.86, mult: 1 },
  { id: "5698", name: "Wakulima (Nairobi)", country: "KE", currency: "KES", lat: -1.29, lon: 36.83, mult: 1 },
  { id: "3356", name: "Garissa town (Garissa)", country: "KE", currency: "KES", lat: -0.46, lon: 39.64, mult: 1 },
  { id: "3267", name: "Takaba (Mandera)", country: "KE", currency: "KES", lat: 3.39, lon: 40.23, mult: 1 },
  { id: "3355", name: "Marigat town (Baringo)", country: "KE", currency: "KES", lat: 0.47, lon: 35.98, mult: 1 },
  { id: "5664", name: "Illbissil Food Market (Kajiado)", country: "KE", currency: "KES", lat: -2.1, lon: 36.79, mult: 1 },
  { id: "5669", name: "Wakulima (Nakuru)", country: "KE", currency: "KES", lat: -0.3, lon: 36.08, mult: 1 },
  { id: "185", name: "Eldoret town (Uasin Gishu)", country: "KE", currency: "KES", lat: 0.52, lon: 35.28, mult: 1 },
  { id: "5896", name: "Lomut (West Pokot)", country: "KE", currency: "KES", lat: 1.44, lon: 35.57, mult: 1 },
  { id: "5897", name: "Makutano (West Pokot)", country: "KE", currency: "KES", lat: 1.25, lon: 35.08, mult: 1 },
];

export const DEFAULT_MARKET_ID = "5671";
export const ROADS: string[][] = [];

// Retained for buyer-post code paths; WFP price screens are KES-only and never convert to UGX.
export const KES_TO_UGX = 28.4;
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
  return Math.max(1, Math.round(straight * 1.3));
}

export interface RouteCost {
  km: number;
  crossesBorder: boolean;
  transportC: number;
  borderC: number;
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
