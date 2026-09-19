"use client";

// S1 — pick a crop (team decision D1). The 3×3 grid mirrors the 1–9 keys, so one press selects.
// "Favourites" are simply pinned to the front of the grid instead of living in a second list.

import { useMemo, useState } from "react";
import Screen, { type ScreenProps } from "../components/Screen";
import { useFeature } from "../core/features";
import { isDigit, type Key } from "../core/keypad";
import { useNav } from "../core/router";
import { useSettings } from "../core/settings";
import { COMMODITIES, market } from "../lib/catalog";
import type { Commodity } from "../lib/types";

const PER_PAGE = 9;

export default function Home({ active }: ScreenProps) {
  const nav = useNav();
  const { settings, toggleFavorite, t } = useSettings();
  const canPhoto = useFeature("ImageUpload");
  const [page, setPage] = useState(0);
  const [sel, setSel] = useState(0);

  const items = useMemo(() => {
    const pinned = settings.favorites
      .map((id) => COMMODITIES.find((c) => c.id === id))
      .filter((c): c is Commodity => c !== undefined);
    return [...pinned, ...COMMODITIES.filter((c) => !settings.favorites.includes(c.id))];
  }, [settings.favorites]);
  const pages = Math.ceil(items.length / PER_PAGE);
  const shown = items.slice(page * PER_PAGE, (page + 1) * PER_PAGE);

  const open = (index: number) => {
    const c = shown[index];
    if (!c) return;
    if (settings.marketId) nav.push("price", { commodityId: c.id });
    else nav.push("area", { then: c.id });
  };

  const onKey = (key: Key): boolean => {
    if (isDigit(key)) {
      if (key === "0") {
        if (canPhoto) nav.push("photo");
        return true;
      }
      setSel(Math.min(Number(key) - 1, shown.length - 1));
      open(Number(key) - 1);
      return true;
    }
    switch (key) {
      case "OK":
        open(sel);
        return true;
      case "LSK":
        nav.push("menu", { scope: "home" });
        return true;
      case "*":
        if (shown[sel]) toggleFavorite(shown[sel].id);
        return true;
      case "Up":
        setSel((s) => (s - 3 + PER_PAGE) % PER_PAGE % shown.length);
        return true;
      case "Down":
        setSel((s) => ((s + 3) % PER_PAGE) % shown.length);
        return true;
      case "Left":
      case "Right": {
        const next = sel + (key === "Right" ? 1 : -1);
        if (next >= 0 && next < shown.length) setSel(next);
        else {
          // Z-navigation across pages: leaving the last cell lands on the next page
          const p = (page + (key === "Right" ? 1 : -1) + pages) % pages;
          setPage(p);
          setSel(key === "Right" ? 0 : Math.min(PER_PAGE, items.length - p * PER_PAGE) - 1);
        }
        return true;
      }
      default:
        return false;
    }
  };

  return (
    <Screen
      active={active}
      title="Mizani"
      sub={settings.marketId ? market(settings.marketId).name : undefined}
      soft={{ l: t("menu"), c: t("ok"), r: t("exit") }}
      onKey={onKey}
    >
      <div className="mut hint">{t("pickCrop")}</div>
      <div className="g9">
        {shown.map((c, i) => (
          <div key={c.id} className={`cell${i === sel ? " on" : ""}`}>
            <b>{i + 1}</b>
            {settings.favorites.includes(c.id) ? <s>★</s> : null}
            <i>{c.icon}</i>
            {settings.lang === "sw" ? c.sw : c.en}
          </div>
        ))}
      </div>
      <div className="row mut hint">
        <span>{canPhoto ? `0 ${t("photo")}` : ""}</span>
        <span>
          {t("page")} {page + 1}/{pages}
        </span>
      </div>
    </Screen>
  );
}
