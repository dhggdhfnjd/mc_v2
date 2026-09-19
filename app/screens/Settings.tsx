"use client";

// Only real user preferences live here. Network simulation and data-reset controls belong in
// developer tooling, not in a low-literacy production menu.

import Screen, { type ScreenProps } from "../components/Screen";
import { Grid, useGridNav, type GridItem } from "../components/ui";
import type { TKey } from "../core/i18n";
import { isDigit, type Key } from "../core/keypad";
import { useNav } from "../core/router";
import { useSettings } from "../core/settings";
import { market } from "../lib/catalog";

// the market list is still one of the three ways to set your location, from the buyer map's
// "From where?"; here the second cell types coordinates instead
const ENTRIES: { icon: string; label: TKey; mode: "lang" | "coords" }[] = [
  { icon: "🌐", label: "lang", mode: "lang" },
  { icon: "📌", label: "coords", mode: "coords" },
];

export default function Settings({ active }: ScreenProps) {
  const nav = useNav();
  const { settings, t } = useSettings();
  const grid = useGridNav(ENTRIES.length, 2);

  const open = (i: number) => {
    const entry = ENTRIES[i];
    if (entry?.mode === "lang") nav.push("langsel", { mode: "lang" });
    if (entry?.mode === "coords") nav.push("coords");
  };

  const onKey = (key: Key): boolean => {
    if (grid.onKey(key)) return true;
    if (key === "OK") return open(grid.index), true;
    if (isDigit(key) && key !== "0") {
      const i = Number(key) - 1;
      if (i < ENTRIES.length) open(i);
      return true;
    }
    return false;
  };

  const values = [
    settings.lang === "en" ? "English" : "Kiswahili",
    settings.fix ? `${settings.fix.lat.toFixed(2)}, ${settings.fix.lon.toFixed(2)}` : settings.marketId ? market(settings.marketId).name : "–",
  ];
  const items: GridItem[] = ENTRIES.map((e, i) => ({
    key: e.mode,
    icon: e.icon,
    label: <>{t(e.label)}<small className="mut"> {values[i]}</small></>,
  }));

  return (
    <Screen active={active} title={t("setting")} soft={{ c: t("ok") }} onKey={onKey}>
      <Grid items={items} sel={grid.index} cols={2} big />
      <div className="mut hint">Mizani 0.2 · demo prices, not live data</div>
    </Screen>
  );
}
