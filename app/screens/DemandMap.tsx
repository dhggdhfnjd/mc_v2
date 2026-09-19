"use client";

// The bubble map (D8, recording 93): type a crop, and demand "bubbles up" along the Busia
// corridor. It is a schematic, not a slippy map: Cloud Phone streams vector draw commands, so
// a static SVG is cheap while raster map tiles would be slow, blurry and costly on data.
// Bubble size = quantity wanted, number = rank by net price. D-pad hops between bubbles;
// pressing a bubble's number jumps straight to it.

import { useMemo, useState } from "react";
import Screen, { type ScreenProps } from "../components/Screen";
import { Row } from "../components/ui";
import { display } from "../core/display";
import { isDigit, type Key } from "../core/keypad";
import { useNav } from "../core/router";
import { useSettings } from "../core/settings";
import { useApi } from "../core/useApi";
import { getDemands, type DemandView } from "../lib/api";
import { KES_TO_UGX, MARKETS, ROADS, commodity, market } from "../lib/catalog";
import { fmt } from "../lib/money";

const W = 240;
const H = 196;
const BORDER_X = 110;

interface Bubble {
  marketId: string;
  x: number;
  y: number;
  r: number;
  best: DemandView;
  kg: number;
}

/** nearest bubble inside a 90° cone in the pressed direction */
function neighbour(from: Bubble, all: Bubble[], key: "Up" | "Down" | "Left" | "Right"): Bubble | null {
  const dir = { Up: [0, -1], Down: [0, 1], Left: [-1, 0], Right: [1, 0] }[key];
  let best: Bubble | null = null;
  let bestCost = Infinity;
  for (const b of all) {
    if (b === from) continue;
    const dx = b.x - from.x;
    const dy = b.y - from.y;
    const along = dx * dir[0] + dy * dir[1];
    const across = Math.abs(dx * dir[1] - dy * dir[0]);
    if (along <= 0 || across > along * 1.4) continue;
    const cost = along + across * 2;
    if (cost < bestCost) [best, bestCost] = [b, cost];
  }
  return best;
}

export default function DemandMap({ active, params }: ScreenProps) {
  const nav = useNav();
  const { settings, t } = useSettings();
  const c = commodity(params.commodityId as string);
  const marketId = settings.marketId ?? "busia-ke";
  const me = market(marketId);
  const d = display(me.currency, KES_TO_UGX);
  const { data } = useApi(`demands.${c.id}.${marketId}`, () => getDemands(c.id, marketId), [c.id, marketId]);
  const [selId, setSelId] = useState<string | null>(null);

  const bubbles = useMemo<Bubble[]>(() => {
    const byMarket = new Map<string, Bubble>();
    for (const x of data ?? []) {
      const m = market(x.marketId);
      const b = byMarket.get(x.marketId);
      if (b) b.kg += x.kg; // ranked list: the first one seen per market is its best bid
      else byMarket.set(x.marketId, { marketId: x.marketId, x: m.x, y: m.y, r: 0, best: x, kg: x.kg });
    }
    const all = [...byMarket.values()];
    all.forEach((b) => (b.r = Math.max(9, Math.min(19, 5 + Math.sqrt(b.kg) / 2.6))));
    return all;
  }, [data]);

  const sel = bubbles.find((b) => b.marketId === selId) ?? bubbles[0] ?? null;

  const onKey = (key: Key): boolean => {
    if (key === "LSK") return nav.back(), true;
    if (!sel) return false;
    if (key === "Up" || key === "Down" || key === "Left" || key === "Right") {
      const next = neighbour(sel, bubbles, key);
      if (next) setSelId(next.marketId);
      return true;
    }
    if (isDigit(key)) {
      const hit = bubbles.find((b) => b.best.rank === Number(key));
      if (hit) setSelId(hit.marketId);
      return true;
    }
    if (key === "OK") return nav.push("demand", { demand: sel.best }), true;
    return false;
  };

  const localC = sel ? sel.best.netC : 0;
  return (
    <Screen
      active={active}
      title={`${t("whoWants")} ${(settings.lang === "sw" ? c.sw : c.en).toLowerCase()}?`}
      soft={{ l: t("list"), c: t("open") }}
      onKey={onKey}
      flush
    >
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", flex: "none" }} role="img" aria-label="demand map of the Busia corridor">
        <rect x="0" y="0" width={W} height={H} fill="#0B130F" />
        <line x1={BORDER_X} y1="0" x2={BORDER_X} y2={H} stroke="#5E7A68" strokeWidth="1" strokeDasharray="3 4" />
        <text x="5" y="11" fill="#8FAE98" fontSize="9">UGANDA</text>
        <text x={W - 5} y="11" fill="#8FAE98" fontSize="9" textAnchor="end">KENYA</text>
        {ROADS.map((road) => (
          <polyline key={road.join()} points={road.map((id) => `${market(id).x},${market(id).y}`).join(" ")} fill="none" stroke="#2C4436" strokeWidth="2" />
        ))}
        {MARKETS.filter((m) => !bubbles.some((b) => b.marketId === m.id) && m.id !== me.id).map((m) => (
          <circle key={m.id} cx={m.x} cy={m.y} r="2.5" fill="#5E7A68" />
        ))}
        {bubbles.map((b) => {
          const on = sel?.marketId === b.marketId;
          const good = b.best.netC >= (data?.[0]?.netC ?? 0) * 0.95;
          return (
            <g key={b.marketId}>
              <circle cx={b.x} cy={b.y} r={b.r} fill={good ? "#2E9E62" : "#3B6B50"} />
              {on ? <circle cx={b.x} cy={b.y} r={b.r + 3} fill="none" stroke="#FFD23F" strokeWidth="2" /> : null}
              <text x={b.x} y={b.y + 4} fill={good ? "#04140B" : "#E2F3E4"} fontSize="12" fontWeight="700" textAnchor="middle">{b.best.rank}</text>
            </g>
          );
        })}
        <rect x={me.x - 4} y={me.y - 4} width="8" height="8" fill="#FFD23F" />
        {sel ? (
          <text x={Math.min(W - 40, Math.max(40, sel.x))} y={sel.y - sel.r - 6 < 12 ? sel.y + sel.r + 12 : sel.y - sel.r - 6} fill="#FFD23F" fontSize="10" fontWeight="700" textAnchor="middle">
            {market(sel.marketId).name}
          </text>
        ) : null}
      </svg>
      <div style={{ padding: "3px 7px 0" }}>
        {sel ? (
          <>
            <Row l={<b>{sel.best.rank} {market(sel.marketId).name}</b>} r={`${d.sym} ${d.perKg(sel.best.bidC)}/kg · ${fmt(sel.kg)} kg`} />
            <Row mut l={`${t("transport")} −${d.perKg(sel.best.transportC)} · ${sel.best.km} km`} r={<span className="up">{t("net")} {d.perKg(localC)}</span>} />
          </>
        ) : (
          <div className="mut">{data ? t("noDemand") : "Loading…"}</div>
        )}
      </div>
    </Screen>
  );
}
