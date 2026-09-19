"use client";

// L3 COORDINATES — the third way to say where you are (after picking a market and GPS): type a
// latitude and longitude. Reached from Settings and from the buyer map's "From where?". OK
// saves the point and makes the nearest market your area, so prices, transport and net all
// follow; the buyer map centres its 50 km view on the point itself.

import { useRef, useState } from "react";
import Screen, { type ScreenProps } from "../components/Screen";
import { Field, Row, useNotice } from "../components/ui";
import type { Key } from "../core/keypad";
import { useNav } from "../core/router";
import { useSettings } from "../core/settings";
import { DEFAULT_MARKET_ID, market } from "../lib/catalog";
import { nearestMarket, parseCoord, typeCoord } from "../lib/coords";
import { fmt } from "../lib/money";

const LIMITS = [90, 180];

export default function Coords({ active, params }: ScreenProps) {
  const nav = useNav();
  const { settings, update, t } = useSettings();
  const start = settings.fix ?? market(settings.marketId ?? DEFAULT_MARKET_ID);
  // kept in a ref as well as state: keys can arrive faster than React re-renders, and each one
  // must see the text the previous one produced
  const form = useRef({ values: [start.lat.toFixed(4), start.lon.toFixed(4)], fresh: [true, true], field: 0 });
  const [, redraw] = useState(0);
  const { values, field } = form.current;
  const [notice, show] = useNotice();

  const lat = parseCoord(values[0], LIMITS[0]);
  const lon = parseCoord(values[1], LIMITS[1]);
  const near = lat !== null && lon !== null ? nearestMarket({ lat, lon }) : null;

  const setField = (f: number) => {
    form.current.field = f;
    redraw((n) => n + 1);
  };
  // the prefilled number is replaced by the first key, like any keypad form
  const setValue = (i: number, v: string) => {
    form.current.values = form.current.values.map((x, j) => (j === i ? v : x));
    form.current.fresh = form.current.fresh.map((x, j) => (j === i ? false : x));
    redraw((n) => n + 1);
  };

  const onKey = (key: Key): boolean => {
    const { values, fresh, field } = form.current;
    const lat = parseCoord(values[0], LIMITS[0]);
    const lon = parseCoord(values[1], LIMITS[1]);
    const near = lat !== null && lon !== null ? nearestMarket({ lat, lon }) : null;
    if (key === "Up" || key === "Down") return setField(1 - field), true;
    if (key === "OK") {
      if (lat === null || lon === null || !near) {
        setField(lat === null ? 0 : 1);
        show(t("checkNumbers"));
        return true;
      }
      update({ fix: { lat, lon, source: "manual" }, marketId: near.market.id });
      nav.back(typeof params.backTo === "number" ? params.backTo : 1);
      return true;
    }
    // the right soft key deletes while there is something to delete, then goes back
    const edit = key === "RSK" ? (values[field] ? "Del" : null) : key;
    if (!edit) return false;
    const next = typeCoord(fresh[field] && edit !== "Del" && edit !== "#" ? "" : values[field], edit);
    if (next === null) return false;
    setValue(field, next);
    return true;
  };

  return (
    <Screen
      active={active}
      title={`📌 ${t("coords")}`}
      soft={{ c: t("ok"), r: values[field] ? "⌫" : undefined }}
      onKey={onKey}
      notice={notice}
    >
      <Field label={t("latitude")} value={values[0]} on={field === 0} />
      <Field label={t("longitude")} value={values[1]} on={field === 1} />
      <div className="mut hint">{t("coordHint")}</div>
      {near ? (
        <Row mut l={`${t("nearest")}: ${near.market.name}`} r={`${fmt(Math.round(near.km))} km`} />
      ) : (
        <Row mut l={t("checkNumbers")} />
      )}
    </Screen>
  );
}
