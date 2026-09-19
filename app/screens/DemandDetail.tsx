"use client";

// L3 — one buyer's open demand, reached from a bubble on the map. Ranked elsewhere by what the
// seller really keeps after transport, because the price and the fare only mean something together.

import Screen, { type ScreenProps } from "../components/Screen";
import { Row, useNotice } from "../components/ui";
import { display } from "../core/display";
import type { Key } from "../core/keypad";
import { useSettings } from "../core/settings";
import { type DemandView } from "../lib/api";
import { KES_TO_UGX, commodity, market } from "../lib/catalog";
import { fmt } from "../lib/money";

export default function DemandDetail({ active, params }: ScreenProps) {
  const { settings, t } = useSettings();
  const x = params.demand as DemandView;
  const c = commodity(x.commodityId);
  const marketId = settings.marketId ?? "busia-ke";
  const d = display(market(marketId).currency, KES_TO_UGX);
  const daysLeft = Math.max(1, Math.ceil((x.expiresAt - Date.now()) / 86_400_000));
  const [notice, show] = useNotice(3200);

  // tel: links need Cloud Phone client 3.1.2+, and the test handset runs 2.5. The dependable
  // path is a text message from the server, which lands in the inbox where she can dial from.
  const onKey = (key: Key): boolean => {
    if (key === "LSK" || key === "OK") return show(t("smsDemo")), true;
    return false;
  };

  return (
    <Screen
      active={active}
      title={market(x.marketId).name}
      sub={`${x.km} km${x.crossesBorder ? " · " + t("crossBorder") : ""}`}
      soft={{ l: t("smsMe") }}
      onKey={onKey}
      notice={notice}
    >
      <Row l={x.buyer} r={x.kept[1] ? <small>{t("kept")} {x.kept[0]}/{x.kept[1]}</small> : undefined} />
      <Row mut l={t("wants")} r={`${fmt(x.kg)} kg ${c.en.toLowerCase()}`} />
      <Row l={t("pays")} r={<>{d.sym} {d.perKg(x.bidC)} /kg</>} />
      <Row mut l={t("transport")} r={`− ${d.perKg(x.transportC)}`} />
      <Row l={<b>{t("youKeep")}</b>} big r={<span className="up">{d.sym} {d.perKg(x.netC)}<small> /kg</small></span>} />
      <Row mut l={t("expires")} r={`${daysLeft} ${t("d")}`} />
      <div className="hr" />
      <div className="mut ctr">{t("callHint")}</div>
      <div className="phone-no">{x.phone}</div>
    </Screen>
  );
}
