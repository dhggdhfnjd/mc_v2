"use client";

// The demand board (D7): buyers post "place + crop + quantity + price", sellers deliver
// themselves — no logistics, no payments. Ranked by what the seller keeps after transport,
// because the recording said "compare the fare AND the price" (D8).

import Screen, { type ScreenProps } from "../components/Screen";
import { Row, useListNav, useNotice } from "../components/ui";
import { display } from "../core/display";
import { shortDate } from "../core/i18n";
import type { Key } from "../core/keypad";
import { useNav } from "../core/router";
import { useSettings } from "../core/settings";
import { useApi } from "../core/useApi";
import { getDemands, type DemandView } from "../lib/api";
import { KES_TO_UGX, commodity, market } from "../lib/catalog";
import { fmt } from "../lib/money";

export function DemandList({ active, params }: ScreenProps) {
  const nav = useNav();
  const { settings, t } = useSettings();
  const c = commodity(params.commodityId as string);
  const marketId = settings.marketId ?? "busia-ke";
  const d = display(market(marketId).currency, KES_TO_UGX);
  const { data, staleAt, error, reload } = useApi(`demands.${c.id}.${marketId}`, () => getDemands(c.id, marketId), [c.id, marketId]);
  const list = useListNav(data?.length ?? 0);

  const onKey = (key: Key): boolean => {
    if (list.onKey(key)) return true;
    if (key === "OK") {
      if (error) reload();
      else if (data?.[list.index]) nav.push("demand", { demand: data[list.index] });
      return true;
    }
    if (key === "LSK") return nav.push("map", { commodityId: c.id }), true;
    return false;
  };

  return (
    <Screen
      active={active}
      title={`${t("whoWants")} ${(settings.lang === "sw" ? c.sw : c.en).toLowerCase()}?`}
      soft={{ l: t("map"), c: error ? t("retry") : t("open") }}
      onKey={onKey}
      notice={staleAt ? `${t("lastUpdated")} ${shortDate(staleAt)}` : null}
    >
      {error ? <div className="vd idle">{t("netError")}</div> : null}
      {data && data.length === 0 ? <div className="mut">{t("noDemand")}</div> : null}
      {data?.map((x, i) => (
        <div key={x.id}>
          <Row on={i === list.index} l={<>{x.rank} {market(x.marketId).name}{x.mine ? " (you)" : ""}</>} r={<>{t("net")} {d.perKg(x.netC)}</>} />
          <Row mut l={`${d.sym} ${d.perKg(x.bidC)}/kg · ${fmt(x.kg)} kg`} r={`${x.km} km`} />
        </div>
      ))}
    </Screen>
  );
}

export function DemandDetail({ active, params }: ScreenProps) {
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
