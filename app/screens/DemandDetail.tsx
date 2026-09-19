"use client";

// One buyer selected from the market's map list. The app does not mediate a conversation: it
// shows the buyer's public number and launches the phone dialler when supported.

import { useMemo } from "react";
import Screen, { type ScreenProps } from "../components/Screen";
import { Row } from "../components/ui";
import { display } from "../core/display";
import { useFeature } from "../core/features";
import type { Key } from "../core/keypad";
import { useSettings } from "../core/settings";
import { useApi } from "../core/useApi";
import { getDemands } from "../lib/api";
import { DEFAULT_MARKET_ID, KES_TO_UGX, commodity, market } from "../lib/catalog";
import { fmt } from "../lib/money";

export default function DemandDetail({ active, params }: ScreenProps) {
  const { settings, t } = useSettings();
  const commodityId = (params.commodityId as string | undefined) ?? settings.foodId;
  const selectedMarket = (params.marketId as string | undefined) ?? settings.marketId ?? DEFAULT_MARKET_ID;
  const demandId = params.demandId as string | undefined;
  const fromId = settings.marketId ?? DEFAULT_MARKET_ID;
  const canCall = useFeature("TelScheme");
  const c = commodity(commodityId);
  const d = display(market(fromId).currency, KES_TO_UGX);
  const { data, error } = useApi(`demand-detail.${commodityId}.${fromId}`, () => getDemands(commodityId, fromId), [commodityId, fromId]);
  const buyers = useMemo(() => (data ?? []).filter((x) => x.marketId === selectedMarket), [data, selectedMarket]);
  const x = buyers.find((buyer) => buyer.id === demandId) ?? buyers[0];

  const onKey = (key: Key): boolean => {
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
      sub={`@${x.username}`}
      soft={{ c: canCall ? t("call") : "" }}
      onKey={onKey}
    >
      {/* the account is the identity; what kind of business it is only adds context */}
      <Row l={<b>@{x.username}</b>} />
      <Row mut l={x.buyer} />
      <Row mut l={t("wants")} r={`${fmt(x.kg)} kg ${settings.lang === "sw" ? c.sw.toLowerCase() : c.en.toLowerCase()}`} />
      <Row l={t("pays")} big r={`${d.sym} ${d.perKg(x.bidC)}/kg`} />
      <Row mut l={t("expires")} r={`${daysLeft} ${t("d")}`} />
      <div className="hr" />
      <div className="mut ctr">{t("callHint")}</div>
      <div className="phone-no">{x.phone}</div>
    </Screen>
  );
}
