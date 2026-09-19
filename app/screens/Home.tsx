"use client";

// Products and photo recognition share one paged 3×3 grid. This screen deliberately has no
// digit shortcuts: the visible highlight, D-pad and OK are the only product-selection model.

import { useState } from "react";
import Screen, { type ScreenProps } from "../components/Screen";
import { Grid, type GridItem } from "../components/ui";
import type { Key } from "../core/keypad";
import { useNav } from "../core/router";
import { useSettings } from "../core/settings";
import { COMMODITIES, market } from "../lib/catalog";

const PER_PAGE = 9;

export default function Home({ active }: ScreenProps) {
  const nav = useNav();
  const { settings, update, t } = useSettings();
  const [index, setIndex] = useState(0);

  const entries = [
    { key: "photo", icon: "📷", label: t("photo"), commodityId: null },
    ...COMMODITIES.map((c) => ({
      key: c.id,
      icon: c.icon,
      label: settings.lang === "sw" ? c.sw : c.en,
      commodityId: c.id,
    })),
  ];
  const safe = Math.min(index, entries.length - 1);
  const page = Math.floor(safe / PER_PAGE);
  const pages = Math.ceil(entries.length / PER_PAGE);
  const start = page * PER_PAGE;
  const shown = entries.slice(start, start + PER_PAGE);

  const open = () => {
    const entry = entries[safe];
    if (!entry) return;
    if (!entry.commodityId) nav.push("photo");
    else {
      update({ foodId: entry.commodityId });
      nav.push("food", { commodityId: entry.commodityId });
    }
  };

  const moveVertical = (delta: number) => {
    const next = safe + delta;
    if (next >= 0 && next < entries.length) setIndex(next);
  };

  const onKey = (key: Key): boolean => {
    switch (key) {
      case "Left":
        return setIndex(safe > 0 ? safe - 1 : entries.length - 1), true;
      case "Right":
        return setIndex(safe + 1 < entries.length ? safe + 1 : 0), true;
      case "Up":
        return moveVertical(-3), true;
      case "Down":
        return moveVertical(3), true;
      case "OK":
        return open(), true;
      case "LSK":
        return nav.push("settings"), true;
      default:
        return false;
    }
  };

  const cells: GridItem[] = shown.map((entry) => ({ key: entry.key, icon: entry.icon, label: entry.label }));

  return (
    <Screen
      active={active}
      title="Mizani"
      sub={settings.marketId ? market(settings.marketId).name : undefined}
      soft={{ l: t("setting"), c: t("ok"), r: t("exit") }}
      onKey={onKey}
    >
      <Grid items={cells} sel={safe - start} big numbered={false} />
      <div className="row mut hint">
        <span>{t("arrowPick")}</span>
        <span>{t("page")} {page + 1}/{pages}</span>
      </div>
    </Screen>
  );
}
