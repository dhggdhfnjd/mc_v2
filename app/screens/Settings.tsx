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

const ENTRIES: { icon: string; label: TKey; mode: "lang" | "country" }[] = [
  { icon: "🌐", label: "lang", mode: "lang" },
  { icon: "📍", label: "country", mode: "country" },
];

export default function Settings({ active }: ScreenProps) {
  const nav = useNav();
  const { settings, t } = useSettings();
  const grid = useGridNav(ENTRIES.length, 2);

  const open = (i: number) => {
    const entry = ENTRIES[i];
    if (entry) nav.push("langsel", { mode: entry.mode });
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
    settings.marketId ? market(settings.marketId).name : "–",
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
