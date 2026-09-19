"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Key } from "../core/keypad";
import { MULTITAP_MS, emptyText, typeText, type TextMode, type TextOpts, type TextState } from "../core/textentry";

/**
 * Keep the focused row visible by scrolling the screen body only — scrollIntoView would also
 * scroll the surrounding page in the desktop frame.
 */
function useKeepVisible(on: boolean | undefined) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const row = ref.current;
    const body = row?.closest<HTMLElement>(".bd");
    if (!on || !row || !body) return;
    const top = row.offsetTop - body.offsetTop;
    if (top < body.scrollTop) body.scrollTop = Math.max(0, top - 24);
    else if (top + row.offsetHeight > body.scrollTop + body.clientHeight) body.scrollTop = top + row.offsetHeight - body.clientHeight + 24;
  }, [on]);
  return ref;
}

/** label left, value right */
export function Row({ l, r, mut, on, big }: { l: ReactNode; r?: ReactNode; mut?: boolean; on?: boolean; big?: boolean }) {
  const ref = useKeepVisible(on);
  return (
    <div ref={ref} className={`row${on ? " on" : ""}${mut ? " mut" : ""}`}>
      <span>{l}</span>
      {r !== undefined ? <span className={big ? "big" : undefined}>{r}</span> : null}
    </div>
  );
}

/** a number the user types with the digit keys; `on` draws the focus frame */
export function Field({ label, value, unit, on }: { label: ReactNode; value: string; unit?: string; on?: boolean }) {
  const ref = useKeepVisible(on);
  return (
    <div ref={ref} className="row">
      <span>{label}</span>
      <span className={`inp${on ? " on" : ""}`}>
        {value || "–"}
        {unit ? <small> {unit}</small> : null}
      </span>
    </div>
  );
}

/**
 * A name or a password typed with the multi-tap alphabet (core/textentry.ts). The label sits
 * above a full-width box because 240 px cannot hold "Username" and sixteen characters on one
 * line, and the current mode is printed inside the box so `*` has a visible meaning.
 *
 * A masked field shows the character still being cycled — press 2 twice and you can see the "b"
 * you are aiming at — and hides it again when the cycle closes. That is the one timer in the
 * app, and it fires once per burst of keys, not on a schedule.
 */
export function TextField({ label, state, mask, on }: { label: ReactNode; state: TextState; mask?: boolean; on?: boolean }) {
  const ref = useKeepVisible(on);
  const [reveal, setReveal] = useState(false);
  useEffect(() => {
    if (!mask) return;
    const hot = !!state.pending;
    setReveal(hot);
    if (!hot) return;
    const timer = setTimeout(() => setReveal(false), MULTITAP_MS);
    return () => clearTimeout(timer);
  }, [state, mask]);

  const shown = mask
    ? "•".repeat(Math.max(0, state.text.length - (reveal ? 1 : 0))) + (reveal ? state.text.slice(-1) : "")
    : state.text;
  return (
    <div ref={ref} className={`tf${on ? " on" : ""}`}>
      <small>{label}</small>
      <div className="inp txt">
        <span>{shown}</span>
        {on ? <u /> : null}
        {on ? <b>{state.mode}</b> : null}
      </div>
    </div>
  );
}

export interface TextFieldSpec {
  mode?: TextMode;
  opts?: TextOpts;
}

/**
 * Up/Down over a few text fields, with every other key going into the focused one. Returns the
 * states to render and a key handler to chain, the same shape as useListNav and useGridNav.
 */
export function useTextForm(fields: TextFieldSpec[]) {
  const [states, setStates] = useState<TextState[]>(() => fields.map((f) => emptyText(f.mode)));
  const [index, setIndex] = useState(0);
  const count = fields.length;

  const onKey = (key: Key): boolean => {
    if (key === "Up" || key === "Down") {
      setIndex((i) => (i + (key === "Down" ? 1 : count - 1)) % count);
      return true;
    }
    const next = typeText(states[index], key, Date.now(), fields[index].opts);
    if (!next) return false;
    setStates((all) => all.map((state, i) => (i === index ? next : state)));
    return true;
  };

  return { states, values: states.map((s) => s.text), index, setIndex, onKey };
}

export function Bars({ n }: { n: 0 | 1 | 2 | 3 }) {
  return (
    <span className="cf" role="img" aria-label={`confidence ${n} of 3`}>
      {[1, 2, 3].map((i) => (
        <i key={i} className={i <= n ? undefined : "off"} />
      ))}
    </span>
  );
}

/** static sparkline — SVG travels to the handset as cheap vector commands */
export function Spark({ points, w = 224, h = 56 }: { points: number[]; w?: number; h?: number }) {
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const xy = points.map((p, i) => [4 + (i * (w - 8)) / (points.length - 1), h - 5 - ((p - min) / span) * (h - 10)] as const);
  const last = xy[xy.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} className="spark" role="img" aria-label="price trend">
      <polyline points={xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ")} fill="none" stroke="#5BE08A" strokeWidth="2" />
      <circle cx={last[0]} cy={last[1]} r="3.5" fill="#FFD23F" />
    </svg>
  );
}

export const Hr = () => <div className="hr" />;

/** Up/Down focus over a list; returns the index and a key handler to chain. */
export function useListNav(count: number, initial = 0) {
  const [index, setIndex] = useState(initial);
  const safe = count === 0 ? 0 : Math.min(index, count - 1);
  const onKey = (key: Key): boolean => {
    if (count === 0) return false;
    if (key === "Up") return setIndex((safe - 1 + count) % count), true;
    if (key === "Down") return setIndex((safe + 1) % count), true;
    return false;
  };
  return { index: safe, setIndex, onKey };
}

/** One option = one icon plus its word. The number badge maps the cell to its digit key. */
export interface GridItem {
  key: string;
  icon: ReactNode;
  label: ReactNode;
  /** pinned marker, used by the food grid for favourites */
  pin?: boolean;
}

export function Grid({ items, sel, cols = 3, big, numbered = true }: { items: GridItem[]; sel: number; cols?: number; big?: boolean; numbered?: boolean }) {
  return (
    <div className={`g9 c${cols}${big ? " big" : ""}`}>
      {items.map((item, i) => (
        <div key={item.key} className={`cell${i === sel ? " on" : ""}`}>
          {numbered ? <b>{i + 1}</b> : null}
          {item.pin ? <s>★</s> : null}
          <i>{item.icon}</i>
          {item.label}
        </div>
      ))}
    </div>
  );
}

/** D-pad focus over a grid: Left/Right walk the cells, Up/Down jump a whole row. */
export function useGridNav(count: number, cols = 3) {
  const [index, setIndex] = useState(0);
  const safe = count === 0 ? 0 : Math.min(index, count - 1);
  const onKey = (key: Key): boolean => {
    if (count === 0) return false;
    switch (key) {
      case "Left":
        return setIndex((safe - 1 + count) % count), true;
      case "Right":
        return setIndex((safe + 1) % count), true;
      case "Up": {
        const up = safe - cols;
        // wrap to the last cell of this column
        return setIndex(up >= 0 ? up : safe + cols * Math.floor((count - 1 - safe) / cols)), true;
      }
      case "Down": {
        const down = safe + cols;
        return setIndex(down < count ? down : safe % cols), true;
      }
      default:
        return false;
    }
  };
  return { index: safe, setIndex, onKey };
}

/** short-lived message line; two screen updates in total (show, hide) */
export function useNotice(ms = 2200): [string | null, (msg: string) => void] {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
  const show = (m: string) => {
    if (timer.current) clearTimeout(timer.current);
    setMsg(m);
    timer.current = setTimeout(() => setMsg(null), ms);
  };
  return [msg, show];
}
