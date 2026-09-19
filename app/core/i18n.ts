// Short strings only: a 240 px line holds about 26 characters of Roboto Condensed.
// Kiswahili strings are a first pass and must be reviewed by a native speaker before launch.

export type Lang = "en" | "sw";

const en = {
  back: "↩", ok: "✓", exit: "Exit", open: "Open",
  photo: "Photo", page: "page",
  food: "Food", nowPrice: "Now price", histPrice: "History", myDeal: "My deals", setting: "Settings",
  buyerMap: "Buyer map", wantBuy: "I want to buy", products: "Products",
  arrowPick: "Arrows + OK", numberOrArrow: "Press 1–4 or use arrows",
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
  quantity: "Quantity", pricePerKg: "Price per kg", phone: "Phone", next: "Next",
  review: "Check details", publish: "Publish", published: "Posted for 3 days",
  publicPhone: "Sellers can see this phone for 3 days", myPost: "My buyer post",
  edit: "Edit", close: "Close", closed: "Post closed", call: "Call",
  closeAsk: "Close this post?",
  unavailable: "Not supported on this phone",
  step: "Step", required: "Complete the highlighted field", buyerPosts: "buyers",
  editHint: "↑↓ field · type numbers · OK",
  nearMe: "Near me", locating: "Finding you…", locate: "Locate", setArea: "Use this",
  noMarketNear: "No market within 100 km", nearest: "Nearest", gps: "GPS", demoLoc: "Demo location", noGps: "No GPS: your area",
  fromWhere: "From where?", myLocation: "My location", pickCity: "Choose city",
  coords: "Coordinates", latitude: "Latitude", longitude: "Longitude", coordHint: "* = decimal point · # = minus",
  checkNumbers: "Check the numbers", noBuyersNear: "No buyers within", wholeMap: "Whole map",
  // accounts: every AuthCode in lib/auth.ts is a key here, so the API can answer in any language
  // a symbol, not a word, so it reads the same in every language (matches back "↩", ok "✓")
  del: "⌫",
  signIn: "Sign in", register: "Register", username: "Name", password: "Password", repeatPass: "Repeat",
  account: "Account", signOut: "Sign out", signOutAsk: "Sign out?", newAccount: "New account",
  postedBy: "Posted by", postingAs: "Posting as", buyerName: "Buyer",
  textHint: "* abc/123 · ↑↓ field · ⌫",
  working: "…",
  userInvalid: "Name: 3–16 a–z 0–9 . _ -", userTaken: "That name is taken",
  passShort: "Password: 4+ characters", passMatch: "The two do not match",
  wrongLogin: "Wrong name or password", needSignIn: "Sign in first",
} as const;

type Dict = Record<keyof typeof en, string>;

const sw: Dict = {
  ...en,
  back: "↩", ok: "✓", exit: "Toka", open: "Fungua",
  photo: "Picha", food: "Chakula", nowPrice: "Bei sasa", histPrice: "Historia", myDeal: "Mauzo yangu", setting: "Mipangilio",
  buyerMap: "Ramani ya wanunuzi", wantBuy: "Nataka kununua", products: "Mazao",
  arrowPick: "Mishale + Sawa", numberOrArrow: "Bonyeza 1–4 au mishale",
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
  quantity: "Kiasi", pricePerKg: "Bei kwa kg", phone: "Simu", next: "Endelea",
  review: "Kagua", publish: "Chapisha", published: "Imewekwa siku 3",
  publicPhone: "Wauzaji wataona simu hii siku 3", myPost: "Tangazo langu",
  edit: "Badili", close: "Funga", closed: "Tangazo limefungwa", call: "Piga",
  closeAsk: "Funga tangazo hili?",
  unavailable: "Simu hii haiwezi kutumia",
  step: "Hatua", required: "Jaza sehemu iliyoangaziwa", buyerPosts: "wanunuzi",
  editHint: "↑↓ sehemu · namba · Sawa",
  nearMe: "Karibu nami", locating: "Inakutafuta…", locate: "Tafuta", setArea: "Tumia hii",
  noMarketNear: "Hakuna soko ndani ya km 100", nearest: "Karibu zaidi", demoLoc: "Mahali pa demo", noGps: "Hakuna GPS: eneo lako",
  fromWhere: "Kutoka wapi?", myLocation: "Mahali pangu", pickCity: "Chagua mji",
  coords: "Viwianishi", latitude: "Latitudo", longitude: "Longitudo", coordHint: "* = nukta · # = hasi",
  checkNumbers: "Kagua namba", noBuyersNear: "Hakuna wanunuzi ndani ya", wholeMap: "Ramani yote",
  signIn: "Ingia", register: "Jisajili", username: "Jina", password: "Nenosiri", repeatPass: "Rudia",
  account: "Akaunti", signOut: "Toka", signOutAsk: "Utoke?", newAccount: "Akaunti mpya",
  postedBy: "Ametuma", postingAs: "Unatuma kama", buyerName: "Mnunuzi",
  textHint: "* abc/123 · ↑↓ sehemu · ⌫",
  userInvalid: "Jina: herufi 3–16", userTaken: "Jina limetumika",
  passShort: "Nenosiri: herufi 4+", passMatch: "Hazifanani",
  wrongLogin: "Jina au nenosiri si sahihi", needSignIn: "Ingia kwanza",
};

const DICTS: Record<Lang, Dict> = { en, sw };
export type TKey = keyof typeof en;
export const translate = (lang: Lang, key: TKey): string => DICTS[lang][key];

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function shortDate(at: number): string {
  const d = new Date(at);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}
