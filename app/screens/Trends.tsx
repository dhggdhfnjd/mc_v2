"use client";

// Monthly WFP history for the same market shown by Now price. Missing months stay blank.

import { useState } from "react";
import Screen, { type ScreenProps } from "../components/Screen";
import { Hr, Row, Spark } from "../components/ui";
import { display } from "../core/display";
import { monthYear } from "../core/i18n";
import type { Key } from "../core/keypad";
import { useNav } from "../core/router";
import { useSettings } from "../core/settings";
import { useApi } from "../core/useApi";
import { getHistory } from "../lib/api";
import { commodity, market } from "../lib/catalog";

const RANGES = [12, 24, 60];

export function History({ active, params }: ScreenProps) {
  const nav = useNav();
  const { settings, t } = useSettings();
  const c = commodity((params.commodityId as string | undefined) ?? settings.foodId);
  const m = market(c.priceMarketId);
  const money = display("KES", 1);
  const [ri, setRi] = useState(0);
  const months = RANGES[ri];
  const { data, error } = useApi(`wfp-history.${c.id}.${months}`, () => getHistory(c.id, months), [c.id, months]);

  const onKey = (key: Key): boolean => {
    if (key === "Left" || key === "Right") return setRi((i) => (i + (key === "Right" ? 1 : RANGES.length - 1)) % RANGES.length), true;
    if (key === "LSK") return nav.home(), true;
    return false;
  };

  return (
    <Screen active={active} title={`${c.icon} ${t("histPrice")}`} sub={m.name} soft={{ l: t("products") }} onKey={onKey}>
      <Row l={<>◀ {months} {t("months")} ▶</>} />
      {error ? <div className="vd idle">{t("netError")}</div> : null}
      {data ? (
        <>
          <Spark points={data.points} fromAt={data.fromAt} toAt={data.toAt} />
          <Row mut l={`${monthYear(data.fromAt)} – ${monthYear(data.toAt)}`} r={`${data.observations}/${data.expectedMonths} ${t("observations").toLowerCase()}`} />
          <div className="mut hint">{t("missingMonths")}</div>
          <Hr />
          <Row l={t("now")} big r={<>KSh {money.perKg(data.nowC)}<small> /kg</small></>} />
          <Row mut l={t("max")} r={money.perKg(data.maxC)} />
          <Row mut l={t("avg")} r={money.perKg(data.avgC)} />
          <Row mut l={t("min")} r={money.perKg(data.minC)} />
        </>
      ) : null}
    </Screen>
  );
}
