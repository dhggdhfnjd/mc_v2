"use client";

// A buyer edits all four values on one screen, then reviews the unchanged confirmation screen.
// The post lasts three days, and an existing post can be edited or closed instead of duplicated.

import { useEffect, useState } from "react";
import Screen, { type ScreenProps } from "../components/Screen";
import { Field, Hr, Row, useListNav, useNotice } from "../components/ui";
import { display } from "../core/display";
import { isDigit, type Key, typeDigit } from "../core/keypad";
import { errorKey } from "../core/errors";
import { useNav } from "../core/router";
import { useSession } from "../core/session";
import { useSettings } from "../core/settings";
import { closeDemand, getMyDemand, postDemand } from "../lib/api";
import { KES_TO_UGX, MARKETS, commodity, market } from "../lib/catalog";
import type { Demand } from "../lib/types";

const DAYS = 3;
const FIELD_COUNT = 4;

export default function DemandPost({ active, params }: ScreenProps) {
  const nav = useNav();
  const { settings, update, t } = useSettings();
  const { user } = useSession();
  const c = commodity((params.commodityId as string | undefined) ?? settings.foodId);
  const startMarket = Math.max(0, MARKETS.findIndex((m) => m.id === (settings.marketId ?? "busia-ke")));
  const [marketIdx, setMarketIdx] = useState(startMarket);
  const [kg, setKg] = useState("");
  const [price, setPrice] = useState("");
  const [phone, setPhone] = useState(settings.phone);
  const [field, setField] = useState(0);
  const [reviewing, setReviewing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [existing, setExisting] = useState<Demand | null | undefined>(undefined);
  const actions = useListNav(3);
  const [notice, show] = useNotice();
  const m = MARKETS[marketIdx];
  const money = display(m.currency, KES_TO_UGX);

  useEffect(() => {
    let alive = true;
    getMyDemand(c.id).then((d) => {
      if (!alive) return;
      setExisting(d);
      if (!d) setEditing(true);
      else {
        setMarketIdx(Math.max(0, MARKETS.findIndex((x) => x.id === d.marketId)));
        setKg(String(d.kg));
        const shown = display(market(d.marketId).currency, KES_TO_UGX).toKes(1);
        setPrice(String(Math.round(d.bidC / 100 / shown)));
        setPhone(d.phone.replace(/\D/g, ""));
      }
    });
    return () => { alive = false; };
  }, [c.id]);

  const openReview = () => {
    const missing = Number(kg) <= 0 ? 1 : Number(price) <= 0 ? 2 : phone.length < 7 ? 3 : -1;
    if (missing >= 0) {
      setField(missing);
      show(t("required"));
      return;
    }
    setReviewing(true);
  };

  const save = async () => {
    let saved;
    try {
      saved = await postDemand({
        commodityId: c.id,
        marketId: m.id,
        kg: Number(kg),
        bidC: Math.round(money.toKes(Number(price)) * 100),
        days: DAYS,
        phone,
      });
    } catch (e) {
      // the post carries a name, so it cannot be written without a session
      show(t(errorKey(e)));
      return;
    }
    update({ phone, marketId: m.id });
    setExisting(saved);
    setEditing(false);
    setField(0);
    setReviewing(false);
    show(t("published"));
  };

  const runManage = async (i: number) => {
    if (!existing) return;
    if (i === 0) {
      setEditing(true);
      setField(0);
      setReviewing(false);
    } else if (i === 1) {
      setConfirmClose(true);
    } else {
      nav.push("map", { commodityId: c.id });
    }
  };

  const close = async () => {
    if (existing) {
      await closeDemand(existing.id);
      setExisting(null);
      setEditing(true);
      setField(0);
      setReviewing(false);
      setConfirmClose(false);
      show(t("closed"));
    }
  };

  const onKey = (key: Key): boolean => {
    if (confirmClose) {
      if (key === "OK") return void close(), true;
      if (key === "RSK") return setConfirmClose(false), true;
      return true;
    }
    if (!editing && existing) {
      if (actions.onKey(key)) return true;
      if (key === "OK") return void runManage(actions.index), true;
      if (isDigit(key) && key >= "1" && key <= "3") return void runManage(Number(key) - 1), true;
      return false;
    }
    if (reviewing) {
      if (key === "RSK") return setReviewing(false), true;
      if (key === "OK") return void save(), true;
      return true;
    }
    if (key === "Up" || key === "Down") {
      return setField((i) => (i + (key === "Down" ? 1 : FIELD_COUNT - 1)) % FIELD_COUNT), true;
    }
    if (field === 0 && (key === "Left" || key === "Right")) {
      return setMarketIdx((i) => (i + (key === "Right" ? 1 : MARKETS.length - 1)) % MARKETS.length), true;
    }
    if (field === 1 || field === 2 || field === 3) {
      const current = field === 1 ? kg : field === 2 ? price : phone;
      const next = field === 3
        ? isDigit(key)
          ? current.length < 15 ? current + key : current
          : key === "Del" ? current.slice(0, -1) : null
        : typeDigit(current, key, 7);
      if (next !== null) {
        if (field === 1) setKg(next);
        else if (field === 2) setPrice(next);
        else setPhone(next);
        return true;
      }
    }
    if (key === "OK") return openReview(), true;
    return false;
  };

  const title = `${c.icon} ${editing ? t("wantBuy") : t("myPost")}`;
  if (existing === undefined) {
    return <Screen active={active} title={title} onKey={onKey}><div className="mut">Loading…</div></Screen>;
  }

  if (!editing && existing) {
    const local = display(market(existing.marketId).currency, KES_TO_UGX);
    const daysLeft = Math.max(1, Math.ceil((existing.expiresAt - Date.now()) / 86_400_000));
    if (confirmClose) return (
      <Screen active={active} title={t("close")} soft={{ c: t("ok") }} onKey={onKey}>
        <div className="vd fair ctr">{t("closeAsk")}</div>
        <Row l={`${c.icon} ${settings.lang === "sw" ? c.sw : c.en}`} r={market(existing.marketId).name} />
      </Screen>
    );
    return (
      <Screen active={active} title={title} sub={market(existing.marketId).name} soft={{ c: t("ok") }} onKey={onKey} notice={notice}>
        <Row l={t("quantity")} r={`${existing.kg} kg`} />
        <Row l={t("pricePerKg")} big r={`${local.sym} ${local.perKg(existing.bidC)}`} />
        <Row mut l={t("expires")} r={`${daysLeft} ${t("d")}`} />
        <Hr />
        {[t("edit"), t("close"), t("buyerMap")].map((label, i) => <Row key={label} on={i === actions.index} l={`${i + 1} ${label}`} />)}
      </Screen>
    );
  }

  return (
    <Screen
      active={active}
      title={title}
      sub={reviewing ? t("review") : undefined}
      soft={{ c: reviewing ? t("publish") : t("next") }}
      onKey={onKey}
      notice={notice}
    >
      {reviewing ? (
        <>
          <Row l={t("market")} r={m.name} />
          <Row l={t("quantity")} r={`${kg} kg`} />
          <Row l={t("pricePerKg")} r={`${money.sym} ${price}/kg`} />
          <Row l={t("phone")} r={phone} />
          <Row mut l={t("postingAs")} r={`@${user}`} />
          <Hr />
          <div className="vd fair ctr">{t("publicPhone")}</div>
        </>
      ) : (
        <>
          <Row on={field === 0} l={t("market")} r={`◀ ${m.name} ▶`} />
          <Field label={t("quantity")} value={kg} unit="kg" on={field === 1} />
          <Field label={t("pricePerKg")} value={price} unit={`${money.sym}/kg`} on={field === 2} />
          <Field label={t("phone")} value={phone} on={field === 3} />
          <div className="mut hint">{t("editHint")}</div>
        </>
      )}
    </Screen>
  );
}
