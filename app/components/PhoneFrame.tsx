"use client";

// Desktop-only stage: the app inside a handset frame with a clickable keypad, so judges and
// teammates can try it from a laptop. On a real Cloud Phone viewport this is never rendered.

import type { ReactNode } from "react";
import { useKeyBus } from "../core/keys";
import type { Key } from "../core/keypad";

export type ScreenSize = "qv" | "qq";

const T9 = ["", "", "abc", "def", "ghi", "jkl", "mno", "pqrs", "tuv", "wxyz"];
const NUMS: Key[] = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"];

export default function PhoneFrame({ size, onSize, children }: { size: ScreenSize; onSize: (s: ScreenSize) => void; children: ReactNode }) {
  const { press } = useKeyBus();
  const key = (k: Key, label: ReactNode, cls = "") => (
    <button key={k} type="button" className={`key ${cls}`} onClick={() => press(k)} tabIndex={-1} aria-label={`key ${k}`}>
      {label}
    </button>
  );

  return (
    <div className="stage">
      <div className="phone">
        <div className="brand">CLOUD PHONE · PREVIEW FRAME</div>
        <div className="lcd" style={{ zoom: size === "qq" ? 2.4 : 1.5 }}>
          <div className={`mz framed ${size}`}>{children}</div>
        </div>
        <div className="pad" style={{ width: size === "qq" ? 317 : 370 }}>
          <div className="pad-top">
            {key("LSK", "━ left", "soft")}
            <div className="pad-dir">
              <span />
              {key("Up", "▲", "dir")}
              <span />
              {key("Left", "◀", "dir")}
              {key("OK", "OK", "dir okk")}
              {key("Right", "▶", "dir")}
              <span />
              {key("Down", "▼", "dir")}
              <span />
            </div>
            {key("RSK", "right ━", "soft")}
          </div>
          <div className="pad-num">
            {NUMS.map((n) => key(n, <>{n}<small>{T9[Number(n)] ?? ""}</small></>))}
          </div>
        </div>
      </div>

      <aside className="side">
        <h1>Mizani</h1>
        <p>
          A bargaining co-pilot for keypad phones at the Busia border (Kenya–Uganda): check the price, do the
          money maths, judge the other side&apos;s offer, find a better buyer.
        </p>
        <h2>Keys</h2>
        <ul>
          <li><kbd>1</kbd>–<kbd>9</kbd> pick a crop · type numbers anywhere</li>
          <li><kbd>↑↓←→</kbd> <kbd>Enter</kbd> move / confirm</li>
          <li><kbd>Esc</kbd> or <kbd>Q</kbd> left soft key</li>
          <li><kbd>F12</kbd> or <kbd>W</kbd> right soft key (back / clear)</li>
          <li><kbd>*</kbd> pin a crop · <kbd>#</kbd> switch KSh / USh</li>
        </ul>
        <h2>Screen</h2>
        <button type="button" className="opt" aria-pressed={size === "qv"} onClick={() => onSize("qv")}>QVGA 240×320</button>
        <button type="button" className="opt" aria-pressed={size === "qq"} onClick={() => onSize("qq")}>QQVGA 128×160</button>
        <h2>Try this</h2>
        <ul>
          <li><kbd>1</kbd> Maize → type <kbd>2</kbd> bags → <kbd>Enter</kbd></li>
          <li>Type their offer <kbd>4250</kbd>: red light, counter-offer, better buyer</li>
          <li><kbd>Enter</kbd> → save the deal → the traders&apos; price updates</li>
          <li><kbd>Esc</kbd> Menu → Where to sell → <kbd>Esc</kbd> Map</li>
        </ul>
        <p style={{ marginTop: 14, fontSize: 12, color: "#7f958a" }}>
          Demo data. On a Cloud Phone the app fills the 240×320 screen and this frame is not shown
          (add <code>?bare=1</code> to see that here).
        </p>
      </aside>
    </div>
  );
}
