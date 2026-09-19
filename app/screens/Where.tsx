"use client";

// L3 FROM WHERE? — opened with 0 on the buyer map. Transport and net are counted from one market:
// either the one nearest the phone (Near me, via navigator.geolocation) or a city picked by hand.
// Both paths return straight to the map.

import Screen, { type ScreenProps } from "../components/Screen";
import { Grid, useGridNav, type GridItem } from "../components/ui";
import type { TKey } from "../core/i18n";
import { isDigit, type Key } from "../core/keypad";
import { useNav } from "../core/router";
import { useSettings } from "../core/settings";
import { market } from "../lib/catalog";

const ENTRIES: { icon: string; label: TKey }[] = [
  { icon: "📍", label: "myLocation" },
  { icon: "🏙️", label: "pickCity" },
];

export default function Where({ active }: ScreenProps) {
  const nav = useNav();
  const { settings, t } = useSettings();
  const grid = useGridNav(ENTRIES.length, 2);

  const open = (i: number) => {
    if (i === 0) nav.push("near", { backTo: 2 });
    if (i === 1) nav.push("langsel", { mode: "country", backTo: 2 });
  };

  const onKey = (key: Key): boolean => {
    if (grid.onKey(key)) return true;
    if (key === "OK") return open(grid.index), true;
    if (isDigit(key) && key !== "0") {
      const i = Number(key) - 1;
      if (i < ENTRIES.length) {
        grid.setIndex(i);
        open(i);
      }
      return true;
    }
    return false;
  };

  const items: GridItem[] = ENTRIES.map((e) => ({ key: e.label, icon: e.icon, label: t(e.label) }));

  return (
    <Screen active={active} title={t("fromWhere")} sub={market(settings.marketId ?? "busia-ke").name} soft={{ c: t("ok") }} onKey={onKey}>
      <Grid items={items} sel={grid.index} cols={2} big />
      <div className="mut hint">{settings.fix ? `📍 ${t("myLocation")}` : `🏙️ ${market(settings.marketId ?? "busia-ke").name}`}</div>
    </Screen>
  );
}
