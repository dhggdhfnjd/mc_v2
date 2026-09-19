"use client";

// L2 — the text branch of the food input: every crop as an icon and its name, nine to a page,
// laid out on the 1–9 keys. Favourites (* to pin) sit at the front instead of in a second list.

import { useMemo, useState } from "react";
import Screen, { type ScreenProps } from "../components/Screen";
import { Grid, type GridItem } from "../components/ui";
import { isDigit, type Key } from "../core/keypad";
import { useNav, type ScreenName } from "../core/router";
import { useSettings } from "../core/settings";
import { COMMODITIES } from "../lib/catalog";
import type { Commodity } from "../lib/types";

const PER_PAGE = 9;

export default function FoodPick({ active, params }: ScreenProps) {
  const nav = useNav();
  const { settings, update, toggleFavorite, t } = useSettings();
  const then = (params.then as ScreenName | undefined) ?? "food";
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
    update({ foodId: c.id });
    nav.replace(then, { commodityId: c.id });
  };

  const onKey = (key: Key): boolean => {
    if (isDigit(key)) {
      if (key === "0") return false;
      const i = Math.min(Number(key) - 1, shown.length - 1);
      setSel(i);
      open(i);
      return true;
    }
    switch (key) {
      case "OK":
        return open(sel), true;
      case "*":
        if (shown[sel]) toggleFavorite(shown[sel].id);
        return true;
      case "Up":
        setSel((s) => (((s - 3 + PER_PAGE) % PER_PAGE) % shown.length));
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

  const cells: GridItem[] = shown.map((c) => ({
    key: c.id,
    icon: c.icon,
    label: settings.lang === "sw" ? c.sw : c.en,
    pin: settings.favorites.includes(c.id),
  }));

  return (
    <Screen active={active} title={t("food")} soft={{ c: t("ok") }} onKey={onKey}>
      <Grid items={cells} sel={sel} />
      <div className="row mut hint">
        <span>* ★</span>
        <span>
          {t("page")} {page + 1}/{pages}
        </span>
      </div>
    </Screen>
  );
}
