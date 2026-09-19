"use client";

// A neutral price card to turn towards the other party: light ground and big type for
// sunlight, source and date on it. The phone becomes the third-party witness.

import Screen, { type ScreenProps } from "../components/Screen";
import { display } from "../core/display";
import { shortDate } from "../core/i18n";
import { useSettings } from "../core/settings";
import { useApi } from "../core/useApi";
import { getPrices } from "../lib/api";
import { commodity, market } from "../lib/catalog";
import { unitPrice } from "../lib/money";

export default function ShowCard({ active, params }: ScreenProps) {
  const { settings, t } = useSettings();
  const c = commodity(params.commodityId as string);
  const unit = c.units.find((u) => u.id === params.unitId) ?? c.units[0];
  const grade = (params.grade as number) || 0;
  const marketId = settings.marketId ?? "busia-ke";
  const m = market(marketId);
  const { data } = useApi(`prices.${c.id}.${marketId}.${grade}`, () => getPrices(c.id, marketId, grade), [c.id, marketId, grade]);
  const d = display(m.currency, data?.kesToUgx ?? 1);

  return (
    <Screen active={active} title={t("market")} sub={m.name} flush>
      {data ? (
        <div className="card">
          <div><b>{c.en.toUpperCase()} · {m.name.toUpperCase()}</b></div>
          <div className="p">{d.sym} {d.perKg(data.govC)}<span style={{ fontSize: "0.4em" }}> /kg</span></div>
          {unit.kg !== 1 ? <div><b>{unit.label} = {d.sym} {d.amt(unitPrice(data.govC, unit.kg))}</b></div> : null}
          <div className="s">
            {data.source} · {shortDate(data.officialAt)} · {t("grade")} {grade + 1}
          </div>
          {data.crowd && data.crowd.confidence > 0 ? (
            <div className="s">{t("cardNote")} {d.sym} {d.perKg(data.crowd.medianC)} ({data.crowd.reporters})</div>
          ) : null}
        </div>
      ) : (
        <div className="card"><div className="s">{t("netError")}</div></div>
      )}
    </Screen>
  );
}
