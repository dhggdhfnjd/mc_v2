"use client";

// S4 — the money (D4) plus the bargaining co-pilot. Each time the other side names a price, the
// trader types it and the screen answers four things: is it acceptable, how much money is at
// stake on the whole lot, what to say next, and where else the goods could go (the demand
// board, D7/D8, doubling as leverage at the stall).

import { useState } from "react";
import Screen, { type ScreenProps } from "../components/Screen";
import { Field, Hr, Row } from "../components/ui";
import { display, other } from "../core/display";
import { shortDate } from "../core/i18n";
import { typeDigit, type Key } from "../core/keypad";
import { useNav } from "../core/router";
import { useSettings } from "../core/settings";
import { useApi } from "../core/useApi";
import { compareMarkets, getDemands, getPrices } from "../lib/api";
import { commodity, market } from "../lib/catalog";
import { counterOffer, fmt, judge, lotDelta, lotTotal, perKgFromUnit, sayable, unitPrice } from "../lib/money";
import type { Side } from "../lib/types";

export default function Calc({ active, params }: ScreenProps) {
  const nav = useNav();
  const { settings, t } = useSettings();
  const c = commodity(params.commodityId as string);
  const unit = c.units.find((u) => u.id === params.unitId) ?? c.units[0];
  const qty = (params.qty as number) || 1;
  const grade = (params.grade as number) || 0;
  const kg = qty * unit.kg;
  const marketId = settings.marketId ?? "busia-ke";
  const m = market(marketId);

  const [side, setSide] = useState<Side>("sell");
  const [offer, setOffer] = useState("");
  const [cost, setCost] = useState("");
  const [field, setField] = useState<0 | 1>(0);
  const [altCur, setAltCur] = useState(false);

  const { data, staleAt, error, reload } = useApi(
    `calc.${c.id}.${marketId}.${grade}.${side}`,
    async () => {
      const [bundle, demands, markets] = await Promise.all([
        getPrices(c.id, marketId, grade),
        getDemands(c.id, marketId),
        compareMarkets(c.id, marketId, side),
      ]);
      const buyer = demands.find((x) => x.marketId !== marketId && !x.mine);
      const place = markets[0];
      // selling: the best net price wins; buying: the cheapest landed cost
      const alt =
        side === "sell" && buyer && (!place || buyer.netC >= place.netC)
          ? { marketId: buyer.marketId, netC: buyer.netC, buyer: true }
          : place
            ? { marketId: place.marketId, netC: place.netC, buyer: false }
            : null;
      return { bundle, alt };
    },
    [c.id, marketId, grade, side],
  );

  const cur = altCur ? other(m.currency) : m.currency;
  const d = display(cur, data?.bundle.kesToUgx ?? 1);
  const typedToC = (s: string) => (s ? perKgFromUnit(d.toKes(Number(s)), unit.kg) : null);
  const offerC = typedToC(offer);
  const limitC = typedToC(cost);

  const onKey = (key: Key): boolean => {
    const [value, set] = field === 0 ? [offer, setOffer] : [cost, setCost];
    const typed = typeDigit(value, key, 8);
    if (typed !== null) return set(typed), true;
    switch (key) {
      case "RSK":
        if (!value) return false;
        return set(value.slice(0, -1)), true;
      case "Up":
      case "Down":
        return setField((f) => (f === 0 ? 1 : 0)), true;
      case "Left":
      case "Right":
        return setSide((s) => (s === "sell" ? "buy" : "sell")), true;
      case "#":
        setOffer("");
        setCost("");
        return setAltCur((a) => !a), true;
      case "LSK":
        return nav.push("card", { commodityId: c.id, unitId: unit.id, grade }), true;
      case "OK":
        if (error) return reload(), true;
        if (data) nav.push("close", { commodityId: c.id, unitId: unit.id, qty, grade, side, offerC, refC: data.bundle.band.refC, altCur });
        return true;
      default:
        return false;
    }
  };

  const title = `${side === "sell" ? t("sell") : t("buy")} ${qty} ${unit.short}`;
  const soft = { l: t("showCard"), c: error ? t("retry") : t("deal"), r: (field === 0 ? offer : cost) ? t("clear") : t("back") };

  if (error || !data) {
    return (
      <Screen active={active} title={title} soft={soft} onKey={onKey}>
        <div className={error ? "vd idle" : "mut"}>{error ? t("netError") : "Loading…"}</div>
      </Screen>
    );
  }

  const { band } = data.bundle;
  const perUnit = (cC: number) => d.amt(unitPrice(cC, unit.kg));
  const verdict = offerC === null ? null : judge(side, offerC, band);
  const delta = offerC === null ? 0 : lotDelta(side, offerC, band.refC, kg);
  const pct = offerC === null ? 0 : Math.round((offerC / band.refC - 1) * 100);
  const belowCost = side === "sell" && offerC !== null && limitC !== null && offerC < limitC;
  const nextC = counterOffer(side, offerC ?? 0, band, limitC); // no offer yet → the opening price
  const next = sayable(d.num(unitPrice(nextC, unit.kg)), cur);

  // "or sell elsewhere": only worth a line when it beats what is on the table
  const compareC = offerC ?? band.refC;
  const altGain = data.alt ? lotDelta(side, data.alt.netC, compareC, kg) : 0;

  const verdictText =
    verdict === null
      ? t("typeOffer")
      : `${verdict === "good" ? t("vGood") : verdict === "fair" ? t("vFair") : side === "sell" ? t("vBadSell") : t("vBadBuy")} · ${
          delta >= 0 ? t("youGain") : t("youLose")
        } ${d.amt(Math.abs(delta))} (${pct > 0 ? "+" : ""}${pct}%)`;

  return (
    <Screen
      active={active}
      title={<>◀ {title} ▶</>}
      sub={`${fmt(kg)} kg`}
      soft={soft}
      onKey={onKey}
      notice={staleAt ? `${t("lastUpdated")} ${shortDate(staleAt)}` : null}
    >
      <Row l={<span className="mut">{t("market")}<span className="only-qv"> {qty} × {perUnit(band.refC)}</span></span>} big r={<>{d.sym} {d.amt(lotTotal(band.refC, qty, unit.kg))}</>} />
      <div className="opt"><Row mut l={`${t("fair")} /${unit.short}`} r={`${perUnit(band.lowC)} – ${perUnit(band.highC)}`} /></div>
      <Hr />
      <Field label={<>{t("theirOffer")}<span className="only-qv"> /{unit.short}</span></>} value={offer ? fmt(Number(offer)) : ""} on={field === 0} />
      <div className={`vd ${verdict ?? "idle"}`}>{belowCost ? `${t("belowCost")} · ${verdictText}` : verdictText}</div>
      <Row l={<b>{side === "sell" ? t("ask") : t("bid")}</b>} r={<b>{d.sym} {fmt(next)}</b>} />
      {data.alt && altGain > 0 ? (
        <Row
          mut
          l={`${side === "sell" ? t("orSell") : t("orBuy")} ${market(data.alt.marketId).name}${data.alt.buyer ? " ★" : ""}`}
          r={<span className="up">{t("net")} +{d.amt(altGain)}</span>}
        />
      ) : null}
      <Hr />
      <Field label={<>{t("myCost")}<span className="only-qv"> /{unit.short}</span></>} value={cost ? fmt(Number(cost)) : ""} on={field === 1} />
    </Screen>
  );
}
