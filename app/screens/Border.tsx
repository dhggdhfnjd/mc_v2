"use client";

// Border & FX. The J-PAL/Sauti intervention gave traders exchange rates and the legal border
// charges; this does the sum for them. Changing money at the post is a negotiation too, so the
// screen says what a quoted street rate costs in shillings. Second page: the EAC Simplified
// Trade Regime rule as a card that can be shown at the desk. It states the rule — it is not
// legal advice, and the RCT found that information alone did not reduce bribery.

import { useState } from "react";
import Screen, { type ScreenProps } from "../components/Screen";
import { Field, Hr, Row } from "../components/ui";
import { typeDigit, type Key } from "../core/keypad";
import { useSettings } from "../core/settings";
import { KES_TO_UGX, STR_LIMIT_USD, USD_TO_KES } from "../lib/catalog";
import { fmt, sayable } from "../lib/money";

export default function Border({ active }: ScreenProps) {
  const { t } = useSettings();
  const [page, setPage] = useState(0);
  const [toUgx, setToUgx] = useState(true);
  const [amount, setAmount] = useState("");
  const [street, setStreet] = useState("");
  const [focus, setFocus] = useState(1);

  const onKey = (key: Key): boolean => {
    if (key === "LSK") return setPage((p) => 1 - p), true;
    if (page === 1) return false;
    const [value, set, max]: [string, (v: string) => void, number] = focus === 2 ? [street, setStreet, 4] : [amount, setAmount, 8];
    if (focus > 0) {
      const typed = typeDigit(value, key, max);
      if (typed !== null) return set(typed), true;
      if (key === "RSK" && value) return set(value.slice(0, -1)), true;
    }
    switch (key) {
      case "Up":
        return setFocus((f) => (f + 2) % 3), true;
      case "Down":
        return setFocus((f) => (f + 1) % 3), true;
      case "Left":
      case "Right":
        if (focus === 0) setToUgx((v) => !v);
        return true;
      default:
        return false;
    }
  };

  const amt = Number(amount || 0);
  // street rates are quoted as "USh per 1 KSh", typed without the decimal point: 279 = 27.9
  const streetRate = street ? Number(street) / 10 : null;
  const fair = toUgx ? sayable(amt * KES_TO_UGX, "UGX") : Math.round(amt / KES_TO_UGX);
  const got = streetRate === null ? null : toUgx ? sayable(amt * streetRate, "UGX") : Math.round(amt / streetRate);
  const lost = got === null ? 0 : fair - got;
  const [from, to] = toUgx ? ["KSh", "USh"] : ["USh", "KSh"];

  if (page === 1) {
    return (
      <Screen active={active} title={t("strTitle")} soft={{ l: "FX" }} onKey={onKey} flush>
        <div className="card">
          <div><b>{t("str1")}</b></div>
          <div className="p" style={{ fontSize: "2em" }}>0%</div>
          <div><b>{t("str2")}</b></div>
          <div><b>{t("str3")}</b></div>
          <div>{t("str4")}</div>
          <div>{t("str5")}</div>
          <div className="s">${fmt(STR_LIMIT_USD)} ≈ KSh {fmt(STR_LIMIT_USD * USD_TO_KES)} · {t("strNote")}</div>
        </div>
      </Screen>
    );
  }

  return (
    <Screen active={active} title={t("border")} soft={{ l: "STR", r: focus > 0 && (focus === 2 ? street : amount) ? t("clear") : t("back") }} onKey={onKey}>
      <Row l={t("rate")} r={`1 KSh = ${KES_TO_UGX} USh`} />
      <Hr />
      <Row on={focus === 0} l="◀ ▶" r={`${from} → ${to}`} />
      <Field label={`${t("amount")} (${from})`} value={amount ? fmt(amt) : ""} on={focus === 1} />
      <Row l={<b>= {to}</b>} big r={fmt(fair)} />
      <Hr />
      <Field label={`${t("street")} ×10`} value={street} on={focus === 2} />
      {got !== null && amt > 0 ? (
        <div className={`vd ${lost > fair * 0.02 ? "bad" : lost > 0 ? "fair" : "good"}`}>
          {to} {fmt(got)} · {t("youLoseFx")} {fmt(Math.max(0, lost))}
        </div>
      ) : (
        <div className="mut">e.g. 279 = 27.9 USh per KSh</div>
      )}
    </Screen>
  );
}
