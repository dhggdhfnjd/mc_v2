"use client";

// All buyers at the selected market are reachable with Up/Down. The app does not mediate a
// conversation: it shows the buyer's public number and launches the phone dialler when supported.

import { useMemo } from "react";
import Screen, { type ScreenProps } from "../components/Screen";
import { Row, useListNav } from "../components/ui";
import { display } from "../core/display";
import { useFeature } from "../core/features";
import type { Key } from "../core/keypad";
import { useSettings } from "../core/settings";
import { useApi } from "../core/useApi";
import { getDemands } from "../lib/api";
import { KES_TO_UGX, commodity, market } from "../lib/catalog";
import { fmt } from "../lib/money";

export default function DemandDetail({ active, params }: ScreenProps) {
  const { settings, t } = useSettings();
  const commodityId = (params.commodityId as string | undefined) ?? settings.foodId;
  const selectedMarket = (params.marketId as string | undefined) ?? settings.marketId ?? "busia-ke";
  const fromId = settings.marketId ?? "busia-ke";
  const canCall = useFeature("TelScheme");
  const c = commodity(commodityId);
  const d = display(market(fromId).currency, KES_TO_UGX);
  const { data, error } = useApi(`demand-detail.${commodityId}.${fromId}`, () => getDemands(commodityId, fromId), [commodityId, fromId]);
  const buyers = useMemo(() => (data ?? []).filter((x) => x.marketId === selectedMarket), [data, selectedMarket]);
  const list = useListNav(buyers.length);
  const x = buyers[list.index];

  const onKey = (key: Key): boolean => {
    if (list.onKey(key)) return true;
    if (key === "OK" && x && canCall) {
      window.location.href = `tel:${x.phone.replace(/\s/g, "")}`;
      return true;
    }
    return false;
  };

  if (!x) {
    return (
      <Screen active={active} title={market(selectedMarket).name} onKey={onKey}>
        <div className="mut">{error ? t("netError") : data ? t("noDemand") : "Loading…"}</div>
      </Screen>
    );
  }

  const daysLeft = Math.max(1, Math.ceil((x.expiresAt - Date.now()) / 86_400_000));
  return (
    <Screen
      active={active}
      title={market(selectedMarket).name}
      sub={`${list.index + 1}/${buyers.length} · ${x.km} km`}
      soft={{ c: canCall ? t("call") : "" }}
      onKey={onKey}
    >
      <Row l={x.buyer} r={buyers.length > 1 ? "↑↓" : undefined} />
      <Row mut l={t("wants")} r={`${fmt(x.kg)} kg ${settings.lang === "sw" ? c.sw.toLowerCase() : c.en.toLowerCase()}`} />
      <Row l={t("pays")} big r={`${d.sym} ${d.perKg(x.bidC)}/kg`} />
      <Row mut l={t("transport")} r={`− ${d.perKg(x.transportC)}`} />
      <Row l={<b>{t("youKeep")}</b>} r={<span className="up">{d.sym} {d.perKg(x.netC)}/kg</span>} />
      <Row mut l={t("expires")} r={`${daysLeft} ${t("d")}`} />
      <div className="hr" />
      <div className="mut ctr">{t("callHint")}</div>
      <div className="phone-no">{x.phone}</div>
    </Screen>
  );
}
