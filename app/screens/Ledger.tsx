"use client";

// L2 MY DEAL LIST — the trader's own book: the week in four numbers, then every saved deal.
// OK opens the L3 detail for the focused row.

import Screen, { type ScreenProps } from "../components/Screen";
import { Hr, Row, useListNav } from "../components/ui";
import { display } from "../core/display";
import { shortDate } from "../core/i18n";
import type { Key } from "../core/keypad";
import { useNav } from "../core/router";
import { useSettings } from "../core/settings";
import { useApi } from "../core/useApi";
import { getDeals, getSummary } from "../lib/api";
import { KES_TO_UGX, commodity, market } from "../lib/catalog";

export default function Ledger({ active }: ScreenProps) {
  const nav = useNav();
  const { settings, t } = useSettings();
  const marketId = settings.marketId ?? "busia-ke";
  const d = display(market(marketId).currency, KES_TO_UGX);
  const { data } = useApi("ledger", async () => ({ deals: await getDeals(), sum: await getSummary() }), []);
  const list = useListNav(data?.deals.length ?? 0);

  const onKey = (key: Key): boolean => {
    if (list.onKey(key)) return true;
    const deal = data?.deals[list.index];
    if (key === "OK" && deal) return nav.push("deal", { deal }), true;
    return false;
  };

  return (
    <Screen active={active} title={t("myDeal")} soft={{ c: data?.deals.length ? t("ok") : "" }} onKey={onKey}>
      {data ? (
        <>
          <Row l={<b>{t("week")}</b>} r={`${data.sum.count} ${t("deals")}`} />
          <Row mut l={t("sold")} r={`${d.sym} ${d.amt(data.sum.soldKes)}`} />
          <Row mut l={t("bought")} r={`${d.sym} ${d.amt(data.sum.boughtKes)}`} />
          <Row
            l={t("vsMarket")}
            r={
              data.sum.vsMarket === null ? "–" : (
                <b className={data.sum.vsMarket >= 0 ? "up" : "dn"}>{data.sum.vsMarket >= 0 ? "+" : ""}{(data.sum.vsMarket * 100).toFixed(1)}%</b>
              )
            }
          />
          <Row mut l={t("trust")} r={"★".repeat(data.sum.stars) + "☆".repeat(5 - data.sum.stars)} />
          <Hr />
          {data.deals.length === 0 ? <div className="mut">{t("noDeals")}</div> : null}
          {data.deals.map((x, i) => {
            const c = commodity(x.commodityId);
            const unit = c.units.find((u) => u.id === x.unitId) ?? c.units[0];
            return (
              <div key={x.id}>
                <Row on={i === list.index} l={`${c.icon} ${x.side === "sell" ? t("sell") : t("buy")} ${x.qty} ${unit.short}`} r={x.priceC === null ? t("noDeal") : `${d.sym} ${d.amt(x.totalKes)}`} />
                <Row mut l={`${shortDate(x.at)} · ${market(x.marketId).name}`} r={x.priceC === null ? "" : `${d.perKg(x.priceC)}/kg${x.photo ? " · photo" : ""}`} />
              </div>
            );
          })}
        </>
      ) : (
        <div className="mut">Loading…</div>
      )}
    </Screen>
  );
}
