"use client";

// L2 MAP VIEW — the bubble map: demand for the filtered food "bubbles up" around you.
// Bubble size = quantity wanted, number = rank by net price. D-pad hops between bubbles;
// pressing a bubble's number jumps straight to it.
//
// Two views. By default the map is framed on 50 km around your location (GPS, typed
// coordinates, or the market you picked) and only buyers inside that circle get bubbles; a row
// counts the ones farther away. * toggles the whole Busia corridor. 0 asks "From where?".
//
// Not a slippy map: Cloud Phone streams draw commands, and panning raster tiles would be slow
// and costly on data. With NEXT_PUBLIC_GOOGLE_MAPS_KEY set at build time each view is one Google
// Static Maps image (lib/staticmap.ts) and everything that changes is SVG on top. Without a key,
// if the image fails, or with ?map=svg, the 50 km view is drawn on a plain background and the
// corridor view on the hand-drawn schematic.

import { useMemo, useState } from "react";
import Screen, { type ScreenProps } from "../components/Screen";
import { Row } from "../components/ui";
import { display } from "../core/display";
import { isDigit, type Key } from "../core/keypad";
import { useNav } from "../core/router";
import { useSettings, type Settings } from "../core/settings";
import { useApi } from "../core/useApi";
import { getDemands, type DemandView } from "../lib/api";
import { KES_TO_UGX, MARKETS, ROADS, commodity, market } from "../lib/catalog";
import { fmt } from "../lib/money";
import { circleBox, distanceKm, fitView, kmPerPx, project, spread, staticMapUrl, type LatLon, type MapView } from "../lib/staticmap";

const W = 240;
const H = 196;
const BORDER_X = 110;
const RADIUS_KM = 50;

const MAP_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? "";
// the extra bottom padding keeps bubbles off the Google logo, which must stay visible
const PAD = { top: 18, right: 16, bottom: 26, left: 16 };
const CORRIDOR = fitView(MARKETS, W / H, PAD, 400);

/** one line saying where distances are counted from, for the map and "From where?" */
export function originLabel(settings: Settings): string {
  const name = market(settings.marketId ?? "busia-ke").name;
  if (settings.fix?.source === "manual") return `📌 ${settings.fix.lat.toFixed(2)}, ${settings.fix.lon.toFixed(2)}`;
  if (settings.fix) return `📍 ${name}`;
  return `🏙️ ${name}`;
}

interface Bubble {
  marketId: string;
  x: number;
  y: number;
  /** true position; x/y may be pushed off it so bubbles do not overlap */
  ax: number;
  ay: number;
  r: number;
  best: DemandView;
  kg: number;
  count: number;
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
  const c = commodity((params.commodityId as string | undefined) ?? settings.foodId);
  const marketId = settings.marketId ?? "busia-ke";
  const me = market(marketId);
  const d = display(me.currency, KES_TO_UGX);
  const { data } = useApi(`demands.${c.id}.${marketId}`, () => getDemands(c.id, marketId), [c.id, marketId]);
  const [selId, setSelId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [failed, setFailed] = useState(false);
  const [forceSvg] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("map") === "svg");

  const origin: LatLon = settings.fix ?? me;
  // rounded to ~1 km so GPS jitter and retyped coordinates reuse the cached image
  const oLat = Math.round(origin.lat * 100) / 100;
  const oLon = Math.round(origin.lon * 100) / 100;
  const nearView = useMemo<MapView>(() => fitView(circleBox({ lat: oLat, lon: oLon }, RADIUS_KM), W / H, PAD, 480), [oLat, oLon]);
  const view = showAll ? CORRIDOR : nearView;
  const scale = W / view.width;
  const imageOk = !!MAP_KEY && !failed && !forceSvg;
  // the 50 km view is always geographic; the corridor falls back to the hand-drawn schematic
  const geo = !showAll || imageOk;
  const toScreen = (p: LatLon) => {
    const q = project(p, view);
    return { x: q.x * scale, y: q.y * scale };
  };
  const pos = (id: string) => (geo ? toScreen(market(id)) : market(id));
  const you = geo ? toScreen(origin) : market(me.id);
  const inRange = (id: string) => showAll || distanceKm(origin, market(id)) <= RADIUS_KM;

  const { bubbles, hidden } = useMemo(() => {
    const byMarket = new Map<string, Bubble>();
    const far = new Set<string>();
    for (const x of data ?? []) {
      if (!inRange(x.marketId)) {
        far.add(x.marketId);
        continue;
      }
      const b = byMarket.get(x.marketId);
      if (b) {
        b.kg += x.kg;
        b.count += 1;
      } else {
        const p = pos(x.marketId);
        byMarket.set(x.marketId, { marketId: x.marketId, x: p.x, y: p.y, ax: p.x, ay: p.y, r: 0, best: x, kg: x.kg, count: 1 });
      }
    }
    const all = [...byMarket.values()];
    all.forEach((b) => (b.r = Math.max(9, Math.min(19, 5 + Math.sqrt(b.kg) / 2.6))));
    // real geography crowds the border towns together; the schematic was drawn apart by hand
    return { bubbles: geo ? spread(all, W, H) : all, hidden: far.size };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, geo, view, oLat, oLon, showAll]);

  const sel = bubbles.find((b) => b.marketId === selId) ?? bubbles[0] ?? null;

  const onKey = (key: Key): boolean => {
    if (key === "LSK") return nav.home(), true;
    if (key === "0") return nav.push("where"), true;
    if (key === "*") return setShowAll((v) => !v), setSelId(null), true;
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
    if (key === "OK") return nav.push("demand", { commodityId: c.id, marketId: sel.marketId }), true;
    return false;
  };

  const localC = sel ? sel.best.netC : 0;
  const onMap = (p: { x: number; y: number }) => p.x >= 0 && p.x <= W && p.y >= 0 && p.y <= H;
  const circlePx = (RADIUS_KM / kmPerPx(oLat, view.zoom)) * scale;
  return (
    <Screen
      active={active}
      title={`${t("whoWants")} ${(settings.lang === "sw" ? c.sw : c.en).toLowerCase()}?`}
      soft={{ l: t("products"), c: t("open") }}
      onKey={onKey}
      flush
    >
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", flex: "none" }} role="img" aria-label="buyer map">
        <rect x="0" y="0" width={W} height={H} fill="#0B130F" />
        {imageOk ? (
          <image href={staticMapUrl(view, MAP_KEY)} x="0" y="0" width={W} height={view.height * scale} preserveAspectRatio="none" onError={() => setFailed(true)} />
        ) : null}
        {showAll && !geo ? (
          <>
            <line x1={BORDER_X} y1="0" x2={BORDER_X} y2={H} stroke="#5E7A68" strokeWidth="1" strokeDasharray="3 4" />
            {ROADS.map((road) => (
              <polyline key={road.join()} points={road.map((id) => `${market(id).x},${market(id).y}`).join(" ")} fill="none" stroke="#2C4436" strokeWidth="2" />
            ))}
          </>
        ) : null}
        {showAll ? (
          <>
            <text x="5" y="11" fill="#8FAE98" fontSize="9">UGANDA</text>
            <text x={W - 5} y="11" fill="#8FAE98" fontSize="9" textAnchor="end">KENYA</text>
          </>
        ) : (
          <>
            <circle cx={you.x} cy={you.y} r={circlePx} fill="#FFD23F" fillOpacity="0.05" stroke="#FFD23F" strokeWidth="1.5" strokeDasharray="4 4" />
            <text x={you.x} y={you.y - circlePx + 11} fill="#FFD23F" fontSize="9" textAnchor="middle" stroke="#0B130F" strokeWidth="3" paintOrder="stroke">{RADIUS_KM} km</text>
          </>
        )}
        {MARKETS.filter((m) => !bubbles.some((b) => b.marketId === m.id) && m.id !== me.id)
          .map((m) => ({ id: m.id, p: pos(m.id) }))
          .filter(({ p }) => onMap(p))
          .map(({ id, p }) => (
            <circle key={id} cx={p.x} cy={p.y} r="2.5" fill="#8FAE98" />
          ))}
        {/* under the bubbles, so a bubble on your own market keeps its number readable */}
        {geo && settings.fix ? (
          <circle cx={you.x} cy={you.y} r="4" fill="#6FB7FF" stroke="#fff" strokeWidth="1.5" />
        ) : (
          <rect x={you.x - 4} y={you.y - 4} width="8" height="8" fill="#FFD23F" stroke="#0B130F" strokeWidth="1" />
        )}
        {bubbles
          .filter((b) => Math.hypot(b.x - b.ax, b.y - b.ay) > 1)
          .map((b) => (
            <g key={`${b.marketId}-leader`}>
              <line x1={b.ax} y1={b.ay} x2={b.x} y2={b.y} stroke="#8FAE98" strokeWidth="1" />
              <circle cx={b.ax} cy={b.ay} r="2" fill="#8FAE98" />
            </g>
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
        {sel ? (
          <text x={Math.min(W - 40, Math.max(40, sel.x))} y={sel.y - sel.r - 6 < 12 ? sel.y + sel.r + 12 : sel.y - sel.r - 6} fill="#FFD23F" fontSize="10" fontWeight="700" textAnchor="middle" stroke="#0B130F" strokeWidth="3" paintOrder="stroke">
            {market(sel.marketId).name}
          </text>
        ) : null}
      </svg>
      <div style={{ padding: "3px 7px 0" }}>
        {sel ? (
          <>
            {/* a post is signed: the account that wants the crop, not just a price on a bubble */}
            <Row l={<b>{sel.best.rank} {market(sel.marketId).name}</b>} r={`@${sel.best.username}`} />
            <Row mut l={`${sel.count} ${t("buyerPosts")} · ${fmt(sel.kg)} kg`} r={<span className="up">{t("net")} {d.perKg(localC)}</span>} />
            <div className="only-qv">
              <Row mut l={`${t("transport")} −${d.perKg(sel.best.transportC)} · ${sel.best.km} km`} />
            </div>
          </>
        ) : (
          <div className="mut">{!data ? "Loading…" : showAll ? t("noDemand") : `${t("noBuyersNear")} ${RADIUS_KM} km`}</div>
        )}
        {/* key hints lead, like the numbered menus: 0 changes the location, * the view */}
        <Row
          mut
          l={`0 ${originLabel(settings)}`}
          r={showAll ? `* ${RADIUS_KM} km` : `* ${t("wholeMap")}${hidden ? ` +${hidden}` : ""}`}
        />
      </div>
    </Screen>
  );
}
