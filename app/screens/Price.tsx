"use client";

// L2 NOW PRICE VIEW — the two reference prices side by side: the official per-kg price on top,
// always with its date, and the traders' reported price with confidence bars below.
// ◀▶ changes the unit so the lot price is read straight off the screen, ▲▼ the grade,
// # flips to the other currency. The left soft key re-filters by food.

import { useState } from "react";
import Screen, { type ScreenProps } from "../components/Screen";
import { Bars, Hr, Row } from "../components/ui";
import { ageText, display, other } from "../core/display";
import { shortDate } from "../core/i18n";
import type { Key } from "../core/keypad";
import { useNav } from "../core/router";
import { useSettings } from "../core/settings";
import { useApi } from "../core/useApi";
import { getPrices } from "../lib/api";
import { commodity, market } from "../lib/catalog";
import { fmt } from "../lib/money";

export default function Price({ active, params }: ScreenProps) {
  const nav = useNav();
  const { settings, t } = useSettings();
  const c = commodity((params.commodityId as string | undefined) ?? settings.foodId);
  const marketId = settings.marketId ?? "busia-ke";
  const m = market(marketId);

  const [unitIdx, setUnitIdx] = useState(0);
  const [grade, setGrade] = useState(0);
  const [altCur, setAltCur] = useState(false);

  const { data, staleAt, error, reload } = useApi(`prices.${c.id}.${marketId}.${grade}`, () => getPrices(c.id, marketId, grade), [c.id, marketId, grade]);
  const unit = c.units[unitIdx];
  const name = settings.lang === "sw" ? c.sw : c.en;

  const onKey = (key: Key): boolean => {
    switch (key) {
      case "Left":
      case "Right":
        return setUnitIdx((i) => (i + (key === "Right" ? 1 : c.units.length - 1)) % c.units.length), true;
      case "Up":
      case "Down":
        return setGrade((g) => (g + (key === "Down" ? 1 : c.grades.length - 1)) % c.grades.length), true;
      case "#":
        return setAltCur((a) => !a), true;
      case "LSK":
        return nav.replace("foodin", { then: "price" }), true;
      case "OK":
        if (error) reload();
        return true;
      default:
        return false;
    }
  };

  const cur = altCur ? other(m.currency) : m.currency;
  const d = display(cur, data?.kesToUgx ?? 1);
  const alt = display(other(cur), data?.kesToUgx ?? 1);

  return (
    <Screen
      active={active}
      title={`${c.icon} ${name}`}
      sub={m.name}
      soft={{ l: t("filter"), c: error ? t("retry") : t("ok") }}
      onKey={onKey}
      notice={staleAt ? `${t("lastUpdated")} ${shortDate(staleAt)}` : null}
    >
      {error ? (
        <div className="vd idle">{t("netError")}</div>
      ) : !data ? (
        <div className="mut">Loading…</div>
      ) : (
        <>
          <Row l={t("official")} big r={<>{d.sym} {d.perKg(data.govC)}<small> /kg</small></>} />
          <div className="mut" style={{ textAlign: "right" }}>
            {data.source} · {shortDate(data.officialAt)}
            {data.officialOld ? <span className="tag-old">{t("old")}</span> : null}
          </div>
          {data.crowd && data.crowd.confidence > 0 ? (
            <>
              <Row l={t("traders")} big r={<>{d.sym} {d.perKg(data.crowd.medianC)}<small> /kg</small></>} />
              <div className="mut" style={{ textAlign: "right" }}>
                <Bars n={data.crowd.confidence} />
                {data.crowd.reporters} {t("traders").toLowerCase()} · {ageText(data.crowd.latestAgeDays)}
              </div>
            </>
          ) : (
            <Row l={t("traders")} r={<span className="mut">{t("notEnough")}</span>} />
          )}
          <Hr />
          <div className="opt"><Row
            mut
            l={<>{t("days7")} <span className={data.trend7 >= 0 ? "up" : "dn"}>{data.trend7 >= 0 ? "▲ +" : "▼ "}{(data.trend7 * 100).toFixed(0)}%</span></>}
            r={<>≈ {alt.sym} {alt.perKg(data.band.refC)} · #</>}
          /></div>
          <Hr />
          <Row l={<>◀ {unit.label} ▶</>} r={<>▲▼ <span className="only-qv">{t("grade")} </span><span className="only-qq">G</span>{grade + 1}</>} />
          <Row
            l={<b>{fmt(unit.kg)} kg</b>}
            big
            r={<>{d.sym} {d.amt(Math.round((data.govC * unit.kg) / 100))}</>}
          />
        </>
      )}
    </Screen>
  );
}
