"use client";

// L3 NEAR ME — buyer map → 0 → My location. The map around the phone: a 100 km circle, the
// markets inside it numbered by distance (nearest first, preselected), and one row saying where
// the location came from (core/location.ts). OK makes the selected market your area, remembers
// the location for the buyer map, and returns there. Same basemap rules as the buyer map.

import { useEffect, useMemo, useState } from "react";
import Screen, { type ScreenProps } from "../components/Screen";
import { Row } from "../components/ui";
import { isDigit, type Key } from "../core/keypad";
import { demoFix, gpsFix, type Fix } from "../core/location";
import { useNav } from "../core/router";
import { useSettings } from "../core/settings";
import { MARKETS, market } from "../lib/catalog";
import { fmt } from "../lib/money";
import { circleBox, distanceKm, fitView, kmPerPx, project, spread, staticMapUrl } from "../lib/staticmap";

const W = 240;
const H = 196;
const RADIUS_KM = 100;
const MAP_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? "";

const km = (d: number) => (d < 10 ? d.toFixed(1) : fmt(Math.round(d)));
const metres = (m: number) => (m < 1000 ? `${Math.round(m)} m` : `${km(m / 1000)} km`);

export default function Nearby({ active, params }: ScreenProps) {
  const nav = useNav();
  const { settings, update, t } = useSettings();
  const [fix, setFix] = useState<Fix | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [sel, setSel] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setFix(null);
    (async () => {
      const found = demoFix() ?? (await gpsFix());
      const home = market(settings.marketId ?? "busia-ke");
      if (alive) setFix(found ?? { lat: home.lat, lon: home.lon, source: "market" });
    })();
    return () => {
      alive = false;
    };
    // settings.marketId is only the fallback; re-locating when it changes would undo "Set area"
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  // rounded to ~1 km so small GPS jitter reuses the cached image
  const centre = fix ? { lat: Math.round(fix.lat * 100) / 100, lon: Math.round(fix.lon * 100) / 100 } : null;
  const view = useMemo(
    () => (centre ? fitView(circleBox(centre, RADIUS_KM), W / H, { top: 6, right: 6, bottom: 6, left: 6 }, 400) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [centre?.lat, centre?.lon],
  );
  const scale = view ? W / view.width : 1;
  const at = (p: { lat: number; lon: number }) => {
    const q = project(p, view!);
    return { x: q.x * scale, y: q.y * scale };
  };

  const byDistance = useMemo(
    () => (fix ? MARKETS.map((m) => ({ m, d: distanceKm(fix, m) })).sort((a, b) => a.d - b.d) : []),
    [fix],
  );
  const inside = byDistance.filter((x) => x.d <= RADIUS_KM);
  const cur = inside[Math.min(sel, inside.length - 1)];
  // the twin Busia towns are 2 km apart: push their discs apart, with a leader line back
  const discs = useMemo(
    () => (view ? spread(inside.map(({ m }) => ({ id: m.id, ...at(m), ax: at(m).x, ay: at(m).y, r: 8 })), W, H, 2) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [view, byDistance],
  );

  const onKey = (key: Key): boolean => {
    if (key === "LSK") return setAttempt((a) => a + 1), true;
    if (!inside.length) return false;
    if (key === "Down" || key === "Right") return setSel((s) => (s + 1) % inside.length), true;
    if (key === "Up" || key === "Left") return setSel((s) => (s - 1 + inside.length) % inside.length), true;
    if (isDigit(key) && Number(key) >= 1 && Number(key) <= inside.length) return setSel(Number(key) - 1), true;
    if (key === "OK" && cur && fix) {
      const located = fix.source !== "market";
      update({ marketId: cur.m.id, fix: located ? { lat: fix.lat, lon: fix.lon, accuracyM: fix.accuracyM, source: "gps" } : null });
      nav.back(typeof params.backTo === "number" ? params.backTo : 1);
      return true;
    }
    return false;
  };

  const source = !fix
    ? t("locating")
    : fix.source === "gps"
      ? `${t("gps")} ±${metres(fix.accuracyM ?? 0)}`
      : fix.source === "demo"
        ? t("demoLoc")
        : t("noGps");

  const me = fix && view ? at(fix) : null;
  const rPx = view && centre ? (RADIUS_KM / kmPerPx(centre.lat, view.zoom)) * scale : 0;
  const accPx = fix?.accuracyM && view && centre ? (fix.accuracyM / 1000 / kmPerPx(centre.lat, view.zoom)) * scale : 0;
  const curPos = cur ? discs.find((d) => d.id === cur.m.id) ?? null : null;

  return (
    <Screen
      active={active}
      title={`📍 ${t("nearMe")}`}
      sub={settings.marketId ? market(settings.marketId).name : undefined}
      soft={{ l: t("locate"), c: inside.length ? t("setArea") : undefined }}
      onKey={onKey}
      flush
    >
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", flex: "none" }} role="img" aria-label="map around your location">
        <rect x="0" y="0" width={W} height={H} fill="#0B130F" />
        {view && centre && MAP_KEY && !failed ? (
          <image href={staticMapUrl(view, MAP_KEY)} x="0" y="0" width={W} height={view.height * scale} preserveAspectRatio="none" onError={() => setFailed(true)} />
        ) : null}
        {me ? (
          <>
            <circle cx={me.x} cy={me.y} r={rPx} fill="#FFD23F" fillOpacity="0.06" stroke="#FFD23F" strokeWidth="1.5" strokeDasharray="4 4" />
            <text x={me.x} y={me.y - rPx + 11} fill="#FFD23F" fontSize="9" textAnchor="middle" stroke="#0B130F" strokeWidth="3" paintOrder="stroke">{RADIUS_KM} km</text>
            {accPx > 3 ? <circle cx={me.x} cy={me.y} r={Math.min(accPx, rPx)} fill="#6FB7FF" fillOpacity="0.15" stroke="#6FB7FF" strokeWidth="1" /> : null}
          </>
        ) : null}
        {view
          ? byDistance
              .filter((x) => x.d > RADIUS_KM)
              .map(({ m }) => at(m))
              .filter((p) => p.x >= 0 && p.x <= W && p.y >= 0 && p.y <= H)
              .map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="2.5" fill="#5E7A68" />)
          : null}
        {me ? <circle cx={me.x} cy={me.y} r="4" fill="#6FB7FF" stroke="#fff" strokeWidth="1.5" /> : null}
        {discs.map((p, i) => {
          const on = cur?.m.id === p.id;
          const moved = Math.hypot(p.x - p.ax, p.y - p.ay) > 1;
          return (
            <g key={p.id}>
              {moved ? <line x1={p.ax} y1={p.ay} x2={p.x} y2={p.y} stroke="#8FAE98" strokeWidth="1" /> : null}
              <circle cx={p.x} cy={p.y} r="8" fill={on ? "#2E9E62" : "#3B6B50"} stroke={on ? "#FFD23F" : "#0B130F"} strokeWidth={on ? 2 : 1} />
              <text x={p.x} y={p.y + 3.5} fill="#E2F3E4" fontSize="10" fontWeight="700" textAnchor="middle">{i + 1}</text>
            </g>
          );
        })}
        {curPos && cur ? (
          <text x={Math.min(W - 40, Math.max(40, curPos.x))} y={curPos.y - 12 < 12 ? curPos.y + 20 : curPos.y - 12} fill="#FFD23F" fontSize="10" fontWeight="700" textAnchor="middle" stroke="#0B130F" strokeWidth="3" paintOrder="stroke">
            {cur.m.name}
          </text>
        ) : null}
      </svg>
      <div style={{ padding: "3px 7px 0" }}>
        {!fix ? (
          <div className="mut">{t("locating")}</div>
        ) : cur ? (
          <Row l={<b>{inside.indexOf(cur) + 1} {cur.m.name}</b>} r={`${km(cur.d)} km`} />
        ) : (
          <>
            <Row l={t("noMarketNear")} />
            <Row mut l={`${t("nearest")}: ${byDistance[0].m.name}`} r={`${km(byDistance[0].d)} km`} />
          </>
        )}
        <Row mut l={source} r={fix ? `${fix.lat.toFixed(3)}, ${fix.lon.toFixed(3)}` : undefined} />
      </div>
    </Screen>
  );
}
