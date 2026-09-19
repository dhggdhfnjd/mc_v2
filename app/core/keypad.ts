// One vocabulary for every way a key can arrive:
//  • Cloud Phone device: LSK is a keydown with key "Escape"; RSK fires the global "back" event
//    (handled in keys.tsx); Enter, arrows, digits, * and # are ordinary keydowns.
//  • Official Meichu demo / simulator convention: F12 stands in for the right soft key.
//  • Desktop conveniences for development: Q = left soft key, W = right soft key.
// Always switch on event.key — "#" shares its legacy keyCode with "3" on Cloud Phone.

export type Digit = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9";
export type Key = "LSK" | "RSK" | "OK" | "Up" | "Down" | "Left" | "Right" | "Del" | "*" | "#" | Digit;

const NAMED: Record<string, Key> = {
  Escape: "LSK",
  F12: "RSK",
  Enter: "OK",
  ArrowUp: "Up",
  ArrowDown: "Down",
  ArrowLeft: "Left",
  ArrowRight: "Right",
  Backspace: "Del",
  "*": "*",
  "#": "#",
  q: "LSK",
  Q: "LSK",
  w: "RSK",
  W: "RSK",
};

export function fromKeyboard(e: KeyboardEvent): Key | null {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  if (/^[0-9]$/.test(e.key)) return e.key as Digit;
  return NAMED[e.key] ?? null;
}

export const isDigit = (k: Key): k is Digit => k.length === 1 && k >= "0" && k <= "9";

/** Digits typed straight into a number: no input box to focus first. */
export function typeDigit(current: string, key: Key, maxLen = 7): string | null {
  if (isDigit(key)) {
    if (current.length >= maxLen) return current;
    return current === "0" ? key : current + key;
  }
  if (key === "Del") return current.slice(0, -1);
  return null;
}
