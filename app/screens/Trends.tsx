"use client";

// History (D9) is the plain trend. Season (D10) is the "flight-fare calendar": twelve bars,
// cheap months green and dear months amber, ending in one sentence about money —
// sell now, or store and wait?

import { useState } from "react";
import Screen, { type ScreenProps } from "../components/Screen";
import { Hr, Row, Spark } from "../components/ui";
import { display } from "../core/display";
import { MONTHS } from "../core/i18n";
import type { Key } from "../core/keypad";
import { useNav } from "../core/router";
import { useSettings } from "../core/settings";
import { useApi } from "../core/useApi";
import { getHistory, getSeason } from "../lib/api";
import { KES_TO_UGX, commodity, market } from "../lib/catalog";

const RANGES = [30, 90, 365];

export function History({ active, params }: ScreenProps) {
  const nav = useNav();
  const { settings, t } = useSettings();
  const c = commodity(params.commodityId as string);
  const marketId = settings.marketId ?? "busia-ke";
  const m = market(marketId);
  const d = display(m.currency, KES_TO_UGX);
  const [ri, setRi] = useState(0);
  const days = RANGES[ri];
  const { data, error } = useApi(`history.${c.id}.${marketId}.${days}`, () => getHistory(c.id, marketId, days), [c.id, marketId, days]);

  const onKey = (key: Key): boolean => {
    if (key === "Left" || key === "Right") return setRi((i) => (i + (key === "Right" ? 1 : RANGES.length - 1)) % RANGES.length), true;
    if (key === "LSK") return nav.replace("season", { commodityId: c.id }), true;
    return false;
  };

  return (
    <Screen active={active} title={`${c.icon} ${t("history")}`} sub={m.name} soft={{ l: t("season") }} onKey={onKey}>
      <Row l={<>◀ {days} {t("days").toLowerCase()} ▶</>} r={data ? <span className={data.change >= 0 ? "up" : "dn"}>{data.change >= 0 ? "▲ +" : "▼ "}{(data.change * 100).toFixed(0)}%</span> : undefined} />
      {error ? <div className="vd idle">{t("netError")}</div> : null}
      {data ? (
        <>
          <Spark points={data.points} />
          <Hr />
          <Row l={t("now")} big r={<>{d.sym} {d.perKg(data.nowC)}<small> /kg</small></>} />
          <Row mut l={t("max")} r={d.perKg(data.maxC)} />
          <Row mut l={t("avg")} r={d.perKg(data.avgC)} />
          <Row mut l={t("min")} r={d.perKg(data.minC)} />
        </>
      ) : null}
    </Screen>
  );
}

export function Season({ active, params }: ScreenProps) {
  const nav = useNav();
  const { settings, t } = useSettings();
  const c = commodity(params.commodityId as string);
  const marketId = settings.marketId ?? "busia-ke";
  const { data } = useApi(`season.${c.id}`, () => getSeason(c.id), [c.id]);

  const onKey = (key: Key): boolean => {
    if (key === "LSK") return nav.replace("history", { commodityId: c.id }), true;
    return false;
  };

  const span = (months: number[]) => months.map((i) => MONTHS[i]).join(" ");
  const lo = data ? Math.min(...data.index) : 0;
  const hi = data ? Math.max(...data.index) : 1;
  const storageLoss = Math.min(0.3, c.perish * 8); // rough three-month shrink: ~3% for grain, 30% cap for tomatoes

  return (
    <Screen active={active} title={`${c.icon} ${t("season")}`} sub={market(marketId).name} soft={{ l: t("history") }} onKey={onKey}>
      {data ? (
        <>
          <div className="bars" aria-hidden="true">
            {data.index.map((v, i) => (
              <span
                key={i}
                className={`${data.low.includes(i) ? "lo" : data.high.includes(i) ? "hi" : ""}${i === data.month ? " now" : ""}`}
                style={{ height: `${18 + ((v - lo) / (hi - lo || 1)) * 82}%` }}
              />
            ))}
          </div>
          <div className="mths">{MONTHS.map((mo) => <span key={mo}>{mo[0]}</span>)}</div>
          <Hr />
          <Row l={<span className="up">{t("low")}</span>} r={span(data.low)} />
          <Row l={<span style={{ color: "#D9982B" }}>{t("high")}</span>} r={span(data.high)} />
          <Row
            l={`${t("now")} (${MONTHS[data.month]})`}
            r={<span className={data.nowVsAvg < 0 ? "dn" : "up"}>{Math.abs(data.nowVsAvg * 100).toFixed(0)}% {data.nowVsAvg < 0 ? t("belowAvg") : t("aboveAvg")}</span>}
          />
          <Hr />
          <Row
            l={t("store3")}
            r={<b className={data.hold3 - storageLoss > 0 ? "up" : "dn"}>{data.hold3 - storageLoss > 0 ? "+" : ""}{((data.hold3 - storageLoss) * 100).toFixed(0)}%</b>}
          />
          <div className="mut">
            {MONTHS[(data.month + 3) % 12]}: {data.hold3 >= 0 ? "+" : ""}{(data.hold3 * 100).toFixed(0)}% price, −{(storageLoss * 100).toFixed(0)}% storage loss
          </div>
        </>
      ) : (
        <div className="mut">Loading…</div>
      )}
    </Screen>
  );
}
