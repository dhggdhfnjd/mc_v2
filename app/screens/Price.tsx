"use client";

// Latest actual WFP wholesale observation. The selected market is the highest normalized price
// among markets reporting on the commodity's latest observation date.

import Screen, { type ScreenProps } from "../components/Screen";
import { Hr, Row } from "../components/ui";
import { display } from "../core/display";
import { monthYear } from "../core/i18n";
import type { Key } from "../core/keypad";
import { useNav } from "../core/router";
import { useSettings } from "../core/settings";
import { useApi } from "../core/useApi";
import { getPrices } from "../lib/api";
import { commodity, market } from "../lib/catalog";

const amount = (n: number) => Math.round(n).toLocaleString("en-KE");

export default function Price({ active, params }: ScreenProps) {
  const nav = useNav();
  const { settings, t } = useSettings();
  const c = commodity((params.commodityId as string | undefined) ?? settings.foodId);
  const m = market(c.priceMarketId);
  const money = display("KES", 1);
  const { data, staleAt, error, reload } = useApi(`wfp-price.${c.id}`, () => getPrices(c.id), [c.id]);

  const onKey = (key: Key): boolean => {
    if (key === "LSK") return nav.home(), true;
    if (key === "OK" && error) return reload(), true;
    return false;
  };

  const diffC = data?.previousPriceC === null || data?.previousPriceC === undefined ? null : data.priceC - data.previousPriceC;
  const direction = diffC === null || Math.abs(diffC) < 1 ? t("same") : diffC > 0 ? t("higher") : t("lower");
  const sourcePackage = data ? c.units.find((u) => u.kg === data.unitKg && u.id !== "kg")?.label ?? data.unitLabel : "";

  return (
    <Screen
      active={active}
      title={`${c.icon} ${settings.lang === "sw" ? c.sw : c.en}`}
      sub={m.name}
      soft={{ l: t("products"), c: error ? t("retry") : t("ok") }}
      onKey={onKey}
      notice={staleAt ? `${t("lastUpdated")} ${monthYear(staleAt)}` : null}
    >
      {error ? (
        <div className="vd idle">{t("netError")}</div>
      ) : !data ? (
        <div className="mut">Loading…</div>
      ) : (
        <>
          <Row l={t("official")} big r={<>KSh {money.perKg(data.priceC)}<small> /kg</small></>} />
          <div className="mut" style={{ textAlign: "right" }}>
            {monthYear(data.observedAt)}
          </div>
          <Row l={`${sourcePackage} ${t("total")}`} r={<>KSh {amount(data.packagePriceKes)}</>} />
          <Hr />
          <Row
            l={t("sinceLast")}
            r={diffC === null ? <span className="mut">{t("notEnough")}</span> : (
              <span className={diffC > 0 ? "up" : diffC < 0 ? "dn" : undefined}>
                {diffC > 0 ? "▲ " : diffC < 0 ? "▼ " : ""}{direction}
              </span>
            )}
          />
          {diffC !== null && data.previousAt ? (
            <Row mut l={`${t("comparedWith")} ${monthYear(data.previousAt)}`} r={`${diffC >= 0 ? "+" : "−"} KSh ${money.perKg(Math.abs(diffC))}/kg`} />
          ) : null}
        </>
      )}
    </Screen>
  );
}
