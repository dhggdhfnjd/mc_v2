"use client";

// L3 — everything known about one food, on one screen: where the best buyer is, what it fetches
// today, and which way the last 30 days went. Each panel is also a door: 1, 2 and 3 open the
// full MAP, NOW PRICE and HISTORY views for the same food.
//
// One screen, one request: getFoodDetail bundles the three reads the panels need.

import Screen, { type ScreenProps } from "../components/Screen";
import { Hr, Row, Spark } from "../components/ui";
import { display } from "../core/display";
import { shortDate } from "../core/i18n";
import { isDigit, type Key } from "../core/keypad";
import { useNav, type ScreenName } from "../core/router";
import { useSettings } from "../core/settings";
import { useApi } from "../core/useApi";
import { getFoodDetail } from "../lib/api";
import { KES_TO_UGX, commodity, market } from "../lib/catalog";

const DOORS: ScreenName[] = ["map", "price", "history"];

export default function FoodDetail({ active, params }: ScreenProps) {
  const nav = useNav();
  const { settings, t } = useSettings();
  const c = commodity((params.commodityId as string | undefined) ?? settings.foodId);
  const marketId = settings.marketId ?? "busia-ke";
  const m = market(marketId);
  const d = display(m.currency, KES_TO_UGX);
  const { data, staleAt, error, reload } = useApi(`food.${c.id}.${marketId}`, () => getFoodDetail(c.id, marketId), [c.id, marketId]);

  const onKey = (key: Key): boolean => {
    if (key === "LSK") return nav.replace("foodin", { then: "food" }), true;
    if (key === "OK" && error) return reload(), true;
    if (isDigit(key) && key !== "0") {
      const door = DOORS[Number(key) - 1];
      if (door) nav.push(door, { commodityId: c.id });
      return true;
    }
    return false;
  };

  const name = settings.lang === "sw" ? c.sw : c.en;

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
          <Row l={`1 🗺️ ${t("bestBuyer")}`} r={data.best ? market(data.best.marketId).name : <span className="mut">{t("noDemand")}</span>} />
          {data.best ? (
            <Row mut l={`${data.best.km} km · ${data.demands} ${t("wants")}`} r={<span className="up">{t("net")} {d.perKg(data.best.netC)}</span>} />
          ) : null}
          <Hr />
          <Row l={`2 💰 ${t("nowPrice")}`} big r={<>{d.sym} {d.perKg(data.price.govC)}<small> /kg</small></>} />
          <Row
            mut
            l={`${data.price.source} · ${shortDate(data.price.officialAt)}`}
            r={data.price.crowd && data.price.crowd.confidence > 0 ? `${t("traders")} ${d.perKg(data.price.crowd.medianC)}` : t("notEnough")}
          />
          <Hr />
          <Row
            l={`3 📈 ${t("histPrice")}`}
            r={<span className={data.history.change >= 0 ? "up" : "dn"}>{data.history.change >= 0 ? "▲ +" : "▼ "}{(data.history.change * 100).toFixed(0)}%</span>}
          />
          <div className="opt"><Spark points={data.history.points} /></div>
        </>
      )}
    </Screen>
  );
}
