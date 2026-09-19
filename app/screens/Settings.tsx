"use client";

// L2 — the setting menu, drawn like every other menu: icon plus word on the number keys.
// Language and country both open the L3 selection screen; the two demo switches act in place.

import Screen, { type ScreenProps } from "../components/Screen";
import { Grid, useGridNav, useNotice, type GridItem } from "../components/ui";
import type { TKey } from "../core/i18n";
import { isDigit, type Key } from "../core/keypad";
import { useNav } from "../core/router";
import { useSettings } from "../core/settings";
import { resetDemoData, type NetworkMode } from "../lib/api";
import { market } from "../lib/catalog";

const NETWORKS: NetworkMode[] = ["ok", "flaky", "down"];

const ENTRIES: { icon: string; label: TKey }[] = [
  { icon: "🌐", label: "lang" },
  { icon: "📍", label: "country" },
  { icon: "📶", label: "network" },
  { icon: "♻️", label: "reset" },
];

export default function Settings({ active }: ScreenProps) {
  const nav = useNav();
  const { settings, update, t, bump } = useSettings();
  const grid = useGridNav(ENTRIES.length);
  const [notice, show] = useNotice();

  const run = (i: number) => {
    switch (i) {
      case 0:
        nav.push("langsel", { mode: "lang" });
        break;
      case 1:
        nav.push("langsel", { mode: "country" });
        break;
      case 2:
        update({ network: NETWORKS[(NETWORKS.indexOf(settings.network) + 1) % NETWORKS.length] });
        break;
      case 3:
        resetDemoData();
        bump();
        show(t("resetDone"));
        break;
    }
  };

  const onKey = (key: Key): boolean => {
    if (grid.onKey(key)) return true;
    if (key === "OK") return run(grid.index), true;
    if (isDigit(key) && key !== "0") {
      const i = Number(key) - 1;
      if (i < ENTRIES.length) {
        grid.setIndex(i);
        run(i);
      }
      return true;
    }
    return false;
  };

  const value = [
    settings.lang === "en" ? "English" : "Kiswahili",
    settings.marketId ? market(settings.marketId).name : "–",
    settings.network,
    "",
  ];
  const items: GridItem[] = ENTRIES.map((e, i) => ({
    key: e.label,
    icon: e.icon,
    label: (
      <>
        {t(e.label)}
        {value[i] ? <small className="mut"> {value[i]}</small> : null}
      </>
    ),
  }));

  return (
    <Screen active={active} title={t("setting")} soft={{ c: t("ok") }} onKey={onKey} notice={notice}>
      <Grid items={items} sel={grid.index} cols={2} big />
      <div className="mut hint">Mizani 0.1 · demo prices, not live data</div>
    </Screen>
  );
}
