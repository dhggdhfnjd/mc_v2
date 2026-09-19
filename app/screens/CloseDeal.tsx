"use client";

// S5 — "Did you close? At what price?" (D5). The entry lands in the trader's own ledger first
// (D12 — that is why she bothers), and the same number becomes an anonymous crowd data point.
// "No deal" is recorded too: an offer that was refused is still a price signal.

import { useRef, useState } from "react";
import Screen, { type ScreenProps } from "../components/Screen";
import { Field, Hr, Row, useNotice } from "../components/ui";
import { display, other } from "../core/display";
import { useFeature } from "../core/features";
import { typeDigit, type Key } from "../core/keypad";
import { useNav } from "../core/router";
import { useSettings } from "../core/settings";
import { postDeal } from "../lib/api";
import { KES_TO_UGX, commodity, market } from "../lib/catalog";
import { changeDue, fairBand, fmt, judge, perKgFromUnit, unitPrice } from "../lib/money";
import type { Side } from "../lib/types";

export default function CloseDeal({ active, params }: ScreenProps) {
  const nav = useNav();
  const { settings, t, bump } = useSettings();
  const canPhoto = useFeature("ImageUpload");
  const c = commodity(params.commodityId as string);
  const unit = c.units.find((u) => u.id === params.unitId) ?? c.units[0];
  const qty = (params.qty as number) || 1;
  const grade = (params.grade as number) || 0;
  const side = (params.side as Side) ?? "sell";
  const refC = params.refC as number;
  const offerC = (params.offerC as number | null) ?? null;
  const marketId = settings.marketId ?? "busia-ke";
  const m = market(marketId);
  const cur = params.altCur ? other(m.currency) : m.currency;
  const d = display(cur, KES_TO_UGX);

  const [final, setFinal] = useState(() => String(d.num(unitPrice(offerC ?? refC, unit.kg))));
  // the prefilled price is a suggestion: the first digit typed replaces it instead of appending
  const [pristine, setPristine] = useState(true);
  const [paid, setPaid] = useState("");
  const [focus, setFocus] = useState(0);
  const [photo, setPhoto] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, show] = useNotice(2600);
  const fileRef = useRef<HTMLInputElement>(null);
  const rows = canPhoto ? 3 : 2;

  const priceC = final ? perKgFromUnit(d.toKes(Number(final)), unit.kg) : null;
  const total = Number(final || 0) * qty;
  // a quick sanity light; the full band lives on the previous screen
  const verdict = priceC === null ? null : judge(side, priceC, fairBand(refC, null, 0.05));

  const save = (closed: boolean) => {
    if (busy || (closed && priceC === null)) return;
    setBusy(true);
    postDeal({
      side, commodityId: c.id, marketId, grade, unitId: unit.id, qty, kg: qty * unit.kg,
      priceC: closed ? priceC : null,
      offerC: closed ? offerC : (priceC ?? offerC),
      refC,
      totalKes: closed ? Math.round(d.toKes(total)) : 0,
      photo: closed && photo,
    })
      .then(({ status }) => {
        bump();
        show(!closed ? t("savedNoDeal") : status === "accepted" ? `${t("saved")} ★` : status === "quarantined" ? `${t("saved")}. ${t("repHeld")}` : `${t("saved")}. ${t("repRejected")}`);
        setTimeout(() => nav.back(2), 1500);
      })
      .catch(() => {
        setBusy(false);
        show(t("netError"));
      });
  };

  const onKey = (key: Key): boolean => {
    if (busy) return true;
    const [value, set] = focus === 0 ? [final, setFinal] : [paid, setPaid];
    if (focus < 2) {
      const fresh = focus === 0 && pristine;
      const typed = typeDigit(fresh ? "" : value, key, 8);
      if (typed !== null) return setPristine(false), set(typed), true;
      if (key === "RSK" && value) return setPristine(false), set(fresh ? "" : value.slice(0, -1)), true;
    }
    switch (key) {
      case "Up":
        return setFocus((f) => (f - 1 + rows) % rows), true;
      case "Down":
        return setFocus((f) => (f + 1) % rows), true;
      case "LSK":
        return save(false), true;
      case "OK":
        if (focus === 2) fileRef.current?.click();
        else save(true);
        return true;
      default:
        return false;
    }
  };

  return (
    <Screen
      active={active}
      title={t("dealDone")}
      sub={`${qty} ${unit.short} · ${qty * unit.kg} kg`}
      soft={{ l: t("noDeal"), c: focus === 2 ? t("photo") : t("save"), r: focus < 2 && (focus === 0 ? final : paid) ? t("clear") : t("back") }}
      onKey={onKey}
      notice={notice}
    >
      <Field label={`${t("finalPrice")} /${unit.short}`} value={final ? fmt(Number(final)) : ""} on={focus === 0} />
      <div className={`vd ${verdict ?? "idle"}`}>
        {d.sym} {fmt(total)} · {priceC !== null ? `${d.perKg(priceC)} /kg` : "–"}
      </div>
      <Hr />
      <Field label={t("buyerPays")} value={paid ? fmt(Number(paid)) : ""} on={focus === 1} />
      <Row l={t("change")} r={<b>{d.sym} {fmt(changeDue(Number(paid || 0), total))}</b>} />
      <Hr />
      {canPhoto ? <Row on={focus === 2} l={photo ? t("photoAdded") : t("addPhoto")} /> : null}
      <div className="mut">{t("helps")}</div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => setPhoto(!!e.target.files?.length)}
      />
    </Screen>
  );
}
