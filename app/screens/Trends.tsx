"use client";

// L2 HISTORY PRICE VIEW — the plain trend for one food. ◀▶ changes the window,
// the left soft key returns to the product grid.

import { useState } from "react";
import Screen, { type ScreenProps } from "../components/Screen";
import { Hr, Row, Spark } from "../components/ui";
import { display } from "../core/display";
import type { Key } from "../core/keypad";
import { useNav } from "../core/router";
import { useSettings } from "../core/settings";
import { useApi } from "../core/useApi";
import { getHistory } from "../lib/api";
import { KES_TO_UGX, commodity, market } from "../lib/catalog";

const RANGES = [30, 90, 365];

export function History({ active, params }: ScreenProps) {
  const nav = useNav();
  const { settings, t } = useSettings();
  const c = commodity((params.commodityId as string | undefined) ?? settings.foodId);
  const marketId = settings.marketId ?? "busia-ke";
  const m = market(marketId);
  const d = display(m.currency, KES_TO_UGX);
  const [ri, setRi] = useState(0);
  const days = RANGES[ri];
  const { data, error } = useApi(`history.${c.id}.${marketId}.${days}`, () => getHistory(c.id, marketId, days), [c.id, marketId, days]);

  const onKey = (key: Key): boolean => {
    if (key === "Left" || key === "Right") return setRi((i) => (i + (key === "Right" ? 1 : RANGES.length - 1)) % RANGES.length), true;
    if (key === "LSK") return nav.home(), true;
    return false;
  };

  return (
    <Screen active={active} title={`${c.icon} ${t("histPrice")}`} sub={m.name} soft={{ l: t("products") }} onKey={onKey}>
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
