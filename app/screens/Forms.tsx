"use client";

// Two short forms. Report (D11): crop is preset to the one being viewed, market is the saved
// area, the user adds side, quality and price. Post a demand (D7): the buyer's side of the board.

import { useState } from "react";
import Screen, { type ScreenProps } from "../components/Screen";
import { Field, Hr, Row, useNotice } from "../components/ui";
import { display } from "../core/display";
import { typeDigit, type Key } from "../core/keypad";
import { useNav } from "../core/router";
import { useSettings } from "../core/settings";
import { postDemand, postReport } from "../lib/api";
import { KES_TO_UGX, commodity, market } from "../lib/catalog";
import { fmt, toC } from "../lib/money";
import type { Side } from "../lib/types";

export function Report({ active, params }: ScreenProps) {
  const nav = useNav();
  const { settings, t, bump } = useSettings();
  const c = commodity(params.commodityId as string);
  const marketId = settings.marketId ?? "busia-ke";
  const m = market(marketId);
  const d = display(m.currency, KES_TO_UGX);

  const [side, setSide] = useState<Side>("sell");
  const [grade, setGrade] = useState(0);
  const [price, setPrice] = useState("");
  const [focus, setFocus] = useState(2);
  const [busy, setBusy] = useState(false);
  const [notice, show] = useNotice(2600);

  const send = () => {
    if (busy || !price) return;
    setBusy(true);
    postReport({ commodityId: c.id, marketId, grade, side, priceC: toC(d.toKes(Number(price))) })
      .then((status) => {
        bump();
        show(status === "accepted" ? t("repAccepted") : status === "quarantined" ? t("repHeld") : t("repRejected"));
        setTimeout(() => nav.back(), 1700);
      })
      .catch(() => {
        setBusy(false);
        show(t("netError"));
      });
  };

  const onKey = (key: Key): boolean => {
    if (busy) return true;
    const typed = typeDigit(price, key, 6);
    if (typed !== null) return setPrice(typed), setFocus(2), true;
    switch (key) {
      case "RSK":
        if (!price) return false;
        return setPrice(price.slice(0, -1)), true;
      case "Up":
        return setFocus((f) => (f + 2) % 3), true;
      case "Down":
        return setFocus((f) => (f + 1) % 3), true;
      case "Left":
      case "Right":
        if (focus === 0) setSide((s) => (s === "sell" ? "buy" : "sell"));
        if (focus === 1) setGrade((g) => (g + (key === "Right" ? 1 : c.grades.length - 1)) % c.grades.length);
        return true;
      case "OK":
        return send(), true;
      default:
        return false;
    }
  };

  return (
    <Screen active={active} title={t("report")} sub={m.name} soft={{ c: t("send"), r: price ? t("clear") : t("back") }} onKey={onKey} notice={notice}>
      <Row l={`${c.icon} ${settings.lang === "sw" ? c.sw : c.en}`} r={<small>{m.name}</small>} />
      <Hr />
      <Row on={focus === 0} l="◀ ▶" r={side === "sell" ? `I sold (${t("sell")})` : `I bought (${t("buy")})`} />
      <Row on={focus === 1} l="◀ ▶" r={`${t("grade")} ${grade + 1}`} />
      <Field label={`${t("price")} /kg (${d.sym})`} value={price ? fmt(Number(price)) : ""} on={focus === 2} />
      <Hr />
      <div className="mut">{t("helps")}</div>
    </Screen>
  );
}

const DAY_OPTIONS = [1, 3, 7];

export function PostDemand({ active, params }: ScreenProps) {
  const nav = useNav();
  const { settings, t, bump } = useSettings();
  const c = commodity(params.commodityId as string);
  const marketId = settings.marketId ?? "busia-ke";
  const m = market(marketId);
  const d = display(m.currency, KES_TO_UGX);

  const [kg, setKg] = useState("");
  const [price, setPrice] = useState("");
  const [phone, setPhone] = useState("");
  const [dayIdx, setDayIdx] = useState(1);
  const [focus, setFocus] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, show] = useNotice(2600);

  const fields: [string, (v: string) => void, number][] = [[kg, setKg, 5], [price, setPrice, 6], ["", () => undefined, 0], [phone, setPhone, 10]];

  const send = () => {
    if (busy || !kg || !price) return;
    // a demand sends someone on a real journey, so unlike a price report it needs a reachable number
    if (phone.length < 9) return show(t("needPhone"));
    setBusy(true);
    postDemand({ commodityId: c.id, marketId, kg: Number(kg), bidC: toC(d.toKes(Number(price))), days: DAY_OPTIONS[dayIdx], phone })
      .then(() => {
        bump();
        show(t("posted"));
        setTimeout(() => nav.back(), 1700);
      })
      .catch(() => {
        setBusy(false);
        show(t("netError"));
      });
  };

  const onKey = (key: Key): boolean => {
    if (busy) return true;
    const [value, set, max] = fields[focus];
    if (focus !== 2) {
      // phone numbers keep their leading zero, so they bypass typeDigit's "0" handling
      const typed = focus === 3 && /^[0-9]$/.test(key) ? (value.length < max ? value + key : value) : typeDigit(value, key, max);
      if (typed !== null) return set(typed), true;
      if (key === "RSK" && value) return set(value.slice(0, -1)), true;
    }
    switch (key) {
      case "Up":
        return setFocus((f) => (f + 3) % 4), true;
      case "Down":
        return setFocus((f) => (f + 1) % 4), true;
      case "Left":
      case "Right":
        if (focus === 2) setDayIdx((i) => (i + (key === "Right" ? 1 : DAY_OPTIONS.length - 1)) % DAY_OPTIONS.length);
        return true;
      case "OK":
        if (focus < 3 && !(kg && price && phone)) return setFocus((f) => (f + 1) % 4), true;
        return send(), true;
      default:
        return false;
    }
  };

  return (
    <Screen
      active={active}
      title={t("postDemand")}
      sub={m.name}
      soft={{ c: focus < 3 && !(kg && price && phone) ? t("next") : t("send"), r: focus !== 2 && fields[focus][0] ? t("clear") : t("back") }}
      onKey={onKey}
      notice={notice}
    >
      <Row l={`${c.icon} ${settings.lang === "sw" ? c.sw : c.en}`} r={<small>{m.name}</small>} />
      <Hr />
      <Field label={`${t("amount")} (kg)`} value={kg ? fmt(Number(kg)) : ""} on={focus === 0} />
      <Field label={`${t("pays")} /kg (${d.sym})`} value={price ? fmt(Number(price)) : ""} on={focus === 1} />
      <Row on={focus === 2} l={`◀ ▶ ${t("days")}`} r={String(DAY_OPTIONS[dayIdx])} />
      <Field label={t("phone")} value={phone} on={focus === 3} />
    </Screen>
  );
}
