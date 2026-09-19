"use client";

// L3 — one saved deal in full: what was agreed, against what the market said that day.
// Read-only; the row it came from already carries the headline.

import Screen, { type ScreenProps } from "../components/Screen";
import { Hr, Row } from "../components/ui";
import { display } from "../core/display";
import { shortDate } from "../core/i18n";
import { useSettings } from "../core/settings";
import type { Deal } from "../lib/types";
import { KES_TO_UGX, commodity, market } from "../lib/catalog";
import { fmt } from "../lib/money";

export default function DealDetail({ active, params }: ScreenProps) {
  const { settings, t } = useSettings();
  const x = params.deal as Deal;
  const c = commodity(x.commodityId);
  const m = market(x.marketId);
  const d = display(m.currency, KES_TO_UGX);
  const name = settings.lang === "sw" ? c.sw : c.en;
  const unit = c.units.find((u) => u.id === x.unitId) ?? c.units[0];
  const vs = x.priceC === null ? null : x.priceC / x.refC - 1;

  return (
    <Screen active={active} title={`${c.icon} ${name}`} sub={`${shortDate(x.at)} · ${m.name}`} soft={{}}>
      <Row l={x.side === "sell" ? t("sold") : t("bought")} r={`${fmt(x.qty)} ${unit.short} · ${fmt(x.kg)} kg`} />
      <Row mut l={t("grade")} r={`${x.grade + 1}`} />
      <Hr />
      {x.priceC === null ? (
        <Row l={<b>{t("noDeal")}</b>} r={x.offerC === null ? undefined : <span className="mut">{t("theirOffer")} {d.perKg(x.offerC)}</span>} />
      ) : (
        <>
          <Row l={t("finalPrice")} big r={<>{d.sym} {d.perKg(x.priceC)}<small> /kg</small></>} />
          <Row l={<b>{t("amount")}</b>} big r={<>{d.sym} {d.amt(x.totalKes)}</>} />
        </>
      )}
      <Hr />
      <Row mut l={`${t("market")} ${d.perKg(x.refC)}`} r={vs === null ? "–" : <span className={vs >= 0 ? "up" : "dn"}>{vs >= 0 ? "+" : ""}{(vs * 100).toFixed(1)}% {t("vsMarket")}</span>} />
      {x.photo ? <div className="mut">{t("photoAdded")}</div> : null}
    </Screen>
  );
}
