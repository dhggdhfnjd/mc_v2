// Short strings only: a 240 px line holds about 26 characters of Roboto Condensed.
// Kiswahili strings are a first pass and must be reviewed by a native speaker before launch.

export type Lang = "en" | "sw";

const en = {
  back: "Back", ok: "OK", menu: "Menu", exit: "Exit", save: "Save", clear: "Clear", next: "Next", open: "Open",
  photo: "Photo", pickCrop: "Press 1–9 · * pin · ◀▶ page", page: "page",
  area: "Your area", pickArea: "Where do you trade?",
  official: "Official", traders: "Traders", notEnough: "Not enough reports yet", beFirst: "Be the first: Menu → Report",
  days7: "7 days", qty: "Qty", unit: "Unit", grade: "Grade", calc: "Calc", old: "old",
  sell: "Sell", buy: "Buy", market: "Market", fair: "Fair", theirOffer: "Their offer", myCost: "My cost",
  per: "per", ask: "Ask", bid: "Bid", floor: "Floor", ceiling: "Limit", orSell: "Or sell in", orBuy: "Or buy in", net: "net",
  vGood: "GOOD", vFair: "FAIR", vBadSell: "LOW", vBadBuy: "HIGH", youGain: "you gain", youLose: "you lose", onLot: "on this lot",
  typeOffer: "Type the price they said", showCard: "Show card", deal: "Deal", belowCost: "Below your cost",
  dealDone: "Deal done?", finalPrice: "Final price", buyerPays: "Cash given", change: "Change", noDeal: "No deal",
  saved: "Saved to My deals", savedNoDeal: "Noted. No deal is useful data too", helps: "Your price helps traders here. No name shown.",
  addPhoto: "Photo of goods: more trust", photoAdded: "Photo added ✓",
  whereSell: "Where to sell", history: "History", season: "Season", report: "Report price", ledger: "My deals",
  border: "Border & FX", settings: "Settings", postDemand: "Post a demand",
  whoWants: "Who wants", list: "List", map: "Map", noDemand: "No open demand", transport: "transport", kept: "kept",
  wants: "wants", pays: "pays", youKeep: "You keep", expires: "Ends in", d: "d", contact: "Contact", callHint: "Dial this number",
  smsMe: "SMS me this", smsDemo: "Demo: the server would text you this contact", crossBorder: "crosses border",
  low: "Low", high: "High", now: "Now", belowAvg: "below year avg", aboveAvg: "above year avg", store3: "Store 3 months",
  minusLoss: "before storage loss", min: "Min", max: "Max", avg: "Avg", range: "◀▶ range",
  price: "Price", send: "Send", repAccepted: "Thank you! Counted", repHeld: "Held until 2 others confirm", repRejected: "Too far from market. Not counted",
  week: "This week", deals: "deals", sold: "Sold", bought: "Bought", vsMarket: "vs market", noDeals: "No deals yet", trust: "Trust",
  rate: "Rate", street: "Street rate", youLoseFx: "You lose", strTitle: "Duty-free rule (STR)",
  str1: "EAC goods under $2,000", str2: "import duty, with a", str3: "Simplified Certificate", str4: "of Origin. Ask the Trade", str5: "Information Desk at the border.", strNote: "Other fees may apply.",
  lang: "Language", network: "Network (demo)", reset: "Reset demo data", resetDone: "Demo data cleared", about: "About",
  lastUpdated: "Offline. Last saved", netError: "No connection. Try again", retry: "Retry",
  isThis: "Is this…?", none: "None of these", photoFail: "Could not read the photo", demoVision: "Demo: colour-based guess",
  kg: "kg", days: "Days", phone: "Phone", posted: "Posted. Sellers can see it", needPhone: "Enter a phone number",
  amount: "Amount", cardNote: "Traders report",
} as const;

type Dict = Record<keyof typeof en, string>;

const sw: Dict = {
  ...en,
  back: "Rudi", ok: "Sawa", menu: "Menyu", exit: "Toka", save: "Hifadhi", clear: "Futa", next: "Endelea", open: "Fungua",
  photo: "Picha", pickCrop: "Bonyeza 1–9 · * bandika", page: "ukurasa",
  area: "Eneo lako", pickArea: "Unafanya biashara wapi?",
  official: "Rasmi", traders: "Wafanyabiashara", notEnough: "Ripoti hazitoshi bado", beFirst: "Kuwa wa kwanza: Menyu → Ripoti",
  days7: "Siku 7", qty: "Kiasi", unit: "Kipimo", grade: "Daraja", calc: "Hesabu", old: "zamani",
  sell: "Uza", buy: "Nunua", market: "Soko", fair: "Haki", theirOffer: "Bei yao", myCost: "Gharama",
  per: "kwa", ask: "Omba", bid: "Toa", floor: "Chini", ceiling: "Kikomo", orSell: "Au uza", orBuy: "Au nunua", net: "baki",
  vGood: "NZURI", vFair: "SAWA", vBadSell: "CHINI", vBadBuy: "JUU", youGain: "unapata", youLose: "unapoteza", onLot: "kwa mzigo",
  typeOffer: "Andika bei waliyosema", showCard: "Onyesha", deal: "Kubali", belowCost: "Chini ya gharama",
  dealDone: "Mmekubaliana?", finalPrice: "Bei ya mwisho", buyerPays: "Pesa taslimu", change: "Chenji", noDeal: "Hapana",
  saved: "Imehifadhiwa", savedNoDeal: "Sawa. Hii pia ni taarifa", helps: "Bei yako husaidia wengine. Hakuna jina.",
  addPhoto: "Picha ya bidhaa: imani zaidi", photoAdded: "Picha imeongezwa ✓",
  whereSell: "Wapi kuuza", history: "Historia", season: "Msimu", report: "Ripoti bei", ledger: "Mauzo yangu",
  border: "Mpaka na sarafu", settings: "Mipangilio", postDemand: "Tangaza hitaji",
  whoWants: "Nani anataka", list: "Orodha", map: "Ramani", noDemand: "Hakuna hitaji", transport: "usafiri", kept: "alitimiza",
  wants: "anataka", pays: "analipa", youKeep: "Unabaki na", expires: "Inaisha", d: "s", contact: "Mawasiliano", callHint: "Piga namba hii",
  smsMe: "Nitumie SMS", crossBorder: "inavuka mpaka",
  low: "Chini", high: "Juu", now: "Sasa", belowAvg: "chini ya wastani", aboveAvg: "juu ya wastani", store3: "Hifadhi miezi 3",
  price: "Bei", send: "Tuma", repAccepted: "Asante! Imehesabiwa", repHeld: "Inasubiri wengine 2", repRejected: "Mbali na soko. Haijahesabiwa",
  week: "Wiki hii", deals: "mauzo", sold: "Umeuza", bought: "Umenunua", vsMarket: "dhidi ya soko", noDeals: "Bado hakuna", trust: "Imani",
  rate: "Kiwango", street: "Bei ya mtaani", youLoseFx: "Unapoteza", strTitle: "Bila ushuru (STR)",
  lang: "Lugha", network: "Mtandao (demo)", reset: "Futa data ya demo", about: "Kuhusu",
  lastUpdated: "Nje ya mtandao. Mwisho", netError: "Hakuna mtandao. Jaribu tena", retry: "Jaribu",
  isThis: "Ni hii…?", none: "Hakuna kati ya hizi",
  days: "Siku", phone: "Simu", amount: "Kiasi",
};

const DICTS: Record<Lang, Dict> = { en, sw };
export type TKey = keyof typeof en;
export const translate = (lang: Lang, key: TKey): string => DICTS[lang][key];

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function shortDate(at: number): string {
  const d = new Date(at);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}
