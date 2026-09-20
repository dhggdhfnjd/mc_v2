"use client";

// L2 MAP VIEW — buyer posts for the selected food, grouped by their exact WFP market.
// Bubble size and number both represent distinct buyers. D-pad moves between markets; OK moves
// into the buyer rows below, where another OK opens the selected buyer's details.
//
// One overview and two zooms. The map opens on every WFP market in Kenya. * zooms in on the
// selected market (50 km around it) to see the buyers there; * again goes back to the overview.
// 0 reads the phone's GPS and zooms to 50 km around it; 0 again goes back. RSK also leaves a zoom
// before it leaves the screen. Without a fix the view stays where it is and the hint row says so:
// a guess never passes for a location.
//
// Not a slippy map: Cloud Phone streams draw commands, and panning raster tiles would be slow
// and costly on data. With NEXT_PUBLIC_GOOGLE_MAPS_KEY set at build time each view is one Google
// Static Maps image (lib/staticmap.ts) and everything that changes is SVG on top. Without a key,
// if the image fails, or with ?map=svg, the exact WFP coordinates remain on a plain background.

import { useMemo, useState } from "react";
import Screen, { type ScreenProps } from "../components/Screen";
import { Row } from "../components/ui";
import type { Key } from "../core/keypad";
import { useNav } from "../core/router";
import { demoFix, gpsFix } from "../core/location";
import { display } from "../core/display";
import { useSettings } from "../core/settings";
import { useApi } from "../core/useApi";
import { getDemands, type DemandView } from "../lib/api";
import { DEFAULT_MARKET_ID, KES_TO_UGX, MARKETS, commodity, market } from "../lib/catalog";
import { nearestMarket } from "../lib/coords";
import { circleBox, distanceKm, fitView, kmPerPx, project, spread, staticMapUrl, type LatLon, type MapView } from "../lib/staticmap";

const W = 240;
const H = 154;
const ZOOM_KM = 50;

const MAP_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? "";
// the extra bottom padding keeps bubbles off the Google logo, which must stay visible
const PAD = { top: 18, right: 16, bottom: 26, left: 16 };
const CORRIDOR = fitView(MARKETS, W / H, PAD, 400);

interface Bubble {
  marketId: string;
  x: number;
  y: number;
  /** true position; x/y may be pushed off it so bubbles do not overlap */
  ax: number;
  ay: number;
  r: number;
  buyers: DemandView[];
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
  const { settings, update, t } = useSettings();
  const c = commodity((params.commodityId as string | undefined) ?? settings.foodId);
  const marketId = settings.marketId ?? DEFAULT_MARKET_ID;
  const money = display(market(marketId).currency, KES_TO_UGX);
  const me = market(marketId);
  const { data } = useApi(`demands.${c.id}.${marketId}`, () => getDemands(c.id, marketId), [c.id, marketId]);
  const [selId, setSelId] = useState<string | null>(null);
  const [listMode, setListMode] = useState(false);
  const [buyerIdx, setBuyerIdx] = useState(0);
  /** null is the overview; * zooms on a market, 0 on the phone's own location */
  const [zoom, setZoom] = useState<{ market: string } | "me" | null>(null);
  const [locating, setLocating] = useState(false);
  const [noGps, setNoGps] = useState(false);
  const [failed, setFailed] = useState(false);
  const [forceSvg] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("map") === "svg");

  const origin: LatLon = settings.fix ?? me;
  // rounded to ~1 km so GPS jitter reuses the cached image
  const oLat = Math.round(origin.lat * 100) / 100;
  const oLon = Math.round(origin.lon * 100) / 100;
  const zoomMarket = zoom && zoom !== "me" ? zoom.market : null;
  const centre: LatLon | null = zoom === "me" ? { lat: oLat, lon: oLon } : zoomMarket ? market(zoomMarket) : null;
  const view = useMemo<MapView>(
    () => (centre ? fitView(circleBox(centre, ZOOM_KM), W / H, PAD, 480) : CORRIDOR),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [zoom === "me", zoomMarket, oLat, oLon],
  );
  const scale = W / view.width;
  const imageOk = !!MAP_KEY && !failed && !forceSvg;
  // Even without a basemap, project the exact WFP coordinates rather than using a schematic.
  const toScreen = (p: LatLon) => {
    const q = project(p, view);
    return { x: q.x * scale, y: q.y * scale };
  };
  const pos = (id: string) => toScreen(market(id));
  const you = toScreen(origin);
  const inRange = (id: string) => !centre || distanceKm(centre, market(id)) <= ZOOM_KM;

  const bubbles = useMemo(() => {
    const byMarket = new Map<string, Map<string, DemandView>>();
    for (const x of data ?? []) {
      if (!inRange(x.marketId)) continue;
      const buyers = byMarket.get(x.marketId) ?? new Map<string, DemandView>();
      const existing = buyers.get(x.username);
      if (!existing || x.createdAt > existing.createdAt) buyers.set(x.username, x);
      byMarket.set(x.marketId, buyers);
    }
    const all = [...byMarket.entries()].map(([id, byBuyer]) => {
      const p = pos(id);
      const buyers = [...byBuyer.values()].sort((a, b) => b.bidC - a.bidC || b.createdAt - a.createdAt);
      const count = buyers.length;
      return { marketId: id, x: p.x, y: p.y, ax: p.x, ay: p.y, r: Math.min(19, 7 + Math.sqrt(count) * 4), buyers, count };
    });
    return spread(all, W, H);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, view]);

  const sel = bubbles.find((b) => b.marketId === selId) ?? bubbles[0] ?? null;
  const selectedBuyer = sel?.buyers[Math.min(buyerIdx, sel.buyers.length - 1)] ?? null;

  const chooseBubble = (next: Bubble | null) => {
    if (!next) return;
    setSelId(next.marketId);
    setBuyerIdx(0);
    setListMode(false);
  };

  /** back to the overview, keeping the market that was selected */
  const overview = () => {
    setZoom(null);
    setBuyerIdx(0);
  };

  const locate = async () => {
    setLocating(true);
    const found = demoFix() ?? (await gpsFix());
    setLocating(false);
    setNoGps(!found);
    if (!found) return;
    // the fix is also where transport costs are counted from, as the old "My location" set it
    update({ marketId: nearestMarket(found).market.id, fix: { lat: found.lat, lon: found.lon, accuracyM: found.accuracyM, source: "gps" } });
    setSelId(null);
    setBuyerIdx(0);
    setZoom("me");
  };

  const onKey = (key: Key): boolean => {
    if (key === "LSK") return nav.home(), true;
    if (locating) return true;
    if (listMode) {
      if (key === "RSK") return setListMode(false), true;
      if (!sel?.buyers.length) return true;
      if (key === "Up" || key === "Down") {
        return setBuyerIdx((i) => (i + (key === "Down" ? 1 : sel.buyers.length - 1)) % sel.buyers.length), true;
      }
      if (key === "OK" && selectedBuyer) {
        return nav.push("demand", { commodityId: c.id, marketId: sel.marketId, demandId: selectedBuyer.id }), true;
      }
      return true;
    }
    if (key === "0") return zoom === "me" ? overview() : void locate(), true;
    if (key === "RSK" && zoom) return overview(), true;
    if (key === "*" && zoomMarket) return overview(), true;
    if (!sel) return false;
    if (key === "*") return setZoom({ market: sel.marketId }), setSelId(sel.marketId), setBuyerIdx(0), true;
    if (key === "Up" || key === "Down" || key === "Left" || key === "Right") {
      const next = neighbour(sel, bubbles, key);
      chooseBubble(next);
      return true;
    }
    if (key === "OK") return setListMode(true), setBuyerIdx(0), true;
    return false;
  };

  const onMap = (p: { x: number; y: number }) => p.x >= 0 && p.x <= W && p.y >= 0 && p.y <= H;
  const ring = centre ? { at: toScreen(centre), px: (ZOOM_KM / kmPerPx(centre.lat, view.zoom)) * scale } : null;
  const gpsHint = locating ? `📍 ${t("locating")}` : zoom === "me" ? `0 ${t("wholeMap")}` : `0 📍 ${t(noGps ? "gpsFailed" : "myLocation")}`;
  const zoomHint = zoomMarket ? `* ${t("wholeMap")}` : sel ? `* 🔍 ${t("zoomIn")}` : "";
  return (
    <Screen
      active={active}
      title={`${t("whoWants")} ${(settings.lang === "sw" ? c.sw : c.en).toLowerCase()}?`}
      soft={{ l: t("products"), c: sel ? t("open") : undefined, r: listMode ? t("map") : undefined }}
      onKey={onKey}
      flush
    >
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", flex: "none" }} role="img" aria-label="buyer map">
        <rect x="0" y="0" width={W} height={H} fill="#0B130F" />
        {imageOk ? (
          <image href={staticMapUrl(view, MAP_KEY)} x="0" y="0" width={W} height={view.height * scale} preserveAspectRatio="none" onError={() => setFailed(true)} />
        ) : null}
        {ring ? (
          <>
            <circle cx={ring.at.x} cy={ring.at.y} r={ring.px} fill="#FFD23F" fillOpacity="0.05" stroke="#FFD23F" strokeWidth="1.5" strokeDasharray="4 4" />
            <text x="5" y="11" fill="#FFD23F" fontSize="9" fontWeight="700" stroke="#0B130F" strokeWidth="3" paintOrder="stroke">
              🔍 {ZOOM_KM} km · {zoom === "me" ? t("myLocation") : market(zoomMarket!).name}
            </text>
          </>
        ) : (
          <text x={W - 5} y="11" fill="#8FAE98" fontSize="9" textAnchor="end">KENYA · WFP MARKETS</text>
        )}
        {MARKETS.filter((m) => !bubbles.some((b) => b.marketId === m.id) && m.id !== me.id)
          .map((m) => ({ id: m.id, p: pos(m.id) }))
          .filter(({ p }) => onMap(p))
          .map(({ id, p }) => (
            <circle key={id} cx={p.x} cy={p.y} r="2.5" fill="#8FAE98" />
          ))}
        {/* under the bubbles, so a bubble on your own market keeps its number readable */}
        {settings.fix ? (
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
          return (
            <g key={b.marketId}>
              <circle cx={b.x} cy={b.y} r={b.r} fill="#2E9E62" />
              {on ? <circle cx={b.x} cy={b.y} r={b.r + 3} fill="none" stroke="#FFD23F" strokeWidth="2" /> : null}
              <text x={b.x} y={b.y + 4} fill="#04140B" fontSize="12" fontWeight="700" textAnchor="middle">{b.count}</text>
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
            <Row l={<b>{market(sel.marketId).name}</b>} r={`${sel.count} ${t("buyerPosts")}`} />
            {sel.buyers.map((buyer, i) => (
              <Row
                key={buyer.id}
                on={listMode && i === buyerIdx}
                l={`@${buyer.username}`}
                r={`${money.sym} ${money.perKg(buyer.bidC)}/kg`}
              />
            ))}
          </>
        ) : (
          <div className="mut">{!data ? "Loading…" : centre ? `${t("noBuyersNear")} ${ZOOM_KM} km` : t("noDemand")}</div>
        )}
        {/* key hints lead, like the numbered menus: 0 is your location, * the selected market */}
        <Row mut l={gpsHint} r={zoomHint} />
      </div>
    </Screen>
  );
}
