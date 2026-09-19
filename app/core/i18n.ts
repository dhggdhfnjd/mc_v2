// Short strings only: a 240 px line holds about 26 characters of Roboto Condensed.
// Kiswahili strings are a first pass and must be reviewed by a native speaker before launch.

export type Lang = "en" | "sw";

const en = {
  back: "↩", ok: "✓", exit: "Exit", open: "Open",
  photo: "Photo", page: "page",
  food: "Food", nowPrice: "Now price", histPrice: "History", myDeal: "My deals", setting: "Settings",
  text: "Text", filter: "Food", pickFood: "Pick the food how?", pickOne: "Press a number",
  country: "Country", bestBuyer: "Best buyer", langCountry: "Language & country",
  pickArea: "Where do you trade?",
  official: "Official", traders: "Traders", notEnough: "Not enough reports yet", days7: "7 days", grade: "Grade", old: "old",
  sell: "Sell", buy: "Buy", market: "Market", theirOffer: "Their offer", net: "net",
  finalPrice: "Final price", noDeal: "No deal",
  photoAdded: "Photo added ✓",
  whoWants: "Who wants", map: "Map", noDemand: "No open demand", transport: "transport", kept: "kept",
  wants: "wants", pays: "pays", youKeep: "You keep", expires: "Ends in", d: "d", callHint: "Dial this number",
  smsMe: "SMS me this", smsDemo: "Demo: the server would text you this contact", crossBorder: "crosses border",
  now: "Now", min: "Min", max: "Max", avg: "Avg", week: "This week", deals: "deals", sold: "Sold", bought: "Bought", vsMarket: "vs market", noDeals: "No deals yet", trust: "Trust",
  lang: "Language", network: "Network (demo)", reset: "Reset demo data", resetDone: "Demo data cleared", lastUpdated: "Offline. Last saved", netError: "No connection. Try again", retry: "Retry",
  isThis: "Is this…?", none: "None of these → grid", photoFail: "Could not read the photo", demoVision: "Model unavailable: rough colour guess",
  visionLoading: "Loading recognizer (37 MB, once)", visionReady: "Recognizer ready. OK to pick a photo", visionWorking: "Looking…", notSure: "Not a crop I know",
  days: "Days", amount: "Amount",
} as const;

type Dict = Record<keyof typeof en, string>;

const sw: Dict = {
  ...en,
  back: "↩", ok: "✓", exit: "Toka", open: "Fungua",
  photo: "Picha", food: "Chakula", nowPrice: "Bei sasa", histPrice: "Historia", myDeal: "Mauzo yangu", setting: "Mipangilio",
  text: "Maandishi", filter: "Chakula", pickFood: "Chagua vipi?", pickOne: "Bonyeza namba",
  country: "Nchi", bestBuyer: "Mnunuzi bora", langCountry: "Lugha na nchi", page: "ukurasa",
  pickArea: "Unafanya biashara wapi?",
  official: "Rasmi", traders: "Wafanyabiashara", notEnough: "Ripoti hazitoshi bado", days7: "Siku 7", grade: "Daraja", old: "zamani",
  sell: "Uza", buy: "Nunua", market: "Soko", theirOffer: "Bei yao", net: "baki",
  finalPrice: "Bei ya mwisho", noDeal: "Hapana",
  photoAdded: "Picha imeongezwa ✓",
  whoWants: "Nani anataka", map: "Ramani", noDemand: "Hakuna hitaji", transport: "usafiri", kept: "alitimiza",
  wants: "anataka", pays: "analipa", youKeep: "Unabaki na", expires: "Inaisha", d: "s", callHint: "Piga namba hii",
  smsMe: "Nitumie SMS", crossBorder: "inavuka mpaka",
  now: "Sasa", week: "Wiki hii", deals: "mauzo", sold: "Umeuza", bought: "Umenunua", vsMarket: "dhidi ya soko", noDeals: "Bado hakuna", trust: "Imani",
  lang: "Lugha", network: "Mtandao (demo)", reset: "Futa data ya demo", lastUpdated: "Nje ya mtandao. Mwisho", netError: "Hakuna mtandao. Jaribu tena", retry: "Jaribu",
  isThis: "Ni hii…?", none: "Hakuna kati ya hizi → orodha", visionLoading: "Inapakia (37 MB, mara moja)", visionReady: "Tayari. Sawa kuchagua picha", visionWorking: "Inaangalia…", notSure: "Sijui zao hili",
  days: "Siku", amount: "Kiasi",
};

const DICTS: Record<Lang, Dict> = { en, sw };
export type TKey = keyof typeof en;
export const translate = (lang: Lang, key: TKey): string => DICTS[lang][key];

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function shortDate(at: number): string {
  const d = new Date(at);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}
