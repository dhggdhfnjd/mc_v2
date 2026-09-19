"use client";

// L1 — the main menu. Six options, each an icon plus its word, laid out on the 1–9 keys so one
// press opens one branch. FOOD asks how you want to name the food; MAP, NOW PRICE and HISTORY
// open straight onto the food you last looked at and carry a Food filter on the left soft key.

import Screen, { type ScreenProps } from "../components/Screen";
import { Grid, useGridNav, type GridItem } from "../components/ui";
import type { TKey } from "../core/i18n";
import { isDigit, type Key } from "../core/keypad";
import { useNav, type ScreenName } from "../core/router";
import { useSettings } from "../core/settings";
import { commodity, market } from "../lib/catalog";

interface Entry {
  icon: string;
  label: TKey;
  screen: ScreenName;
  /** the three filtered views need a food before they can draw anything */
  filtered?: boolean;
}

const ENTRIES: Entry[] = [
  { icon: "🥬", label: "food", screen: "foodin" },
  { icon: "🗺️", label: "map", screen: "map", filtered: true },
  { icon: "💰", label: "nowPrice", screen: "price", filtered: true },
  { icon: "📈", label: "histPrice", screen: "history", filtered: true },
  { icon: "📒", label: "myDeal", screen: "ledger" },
  { icon: "⚙️", label: "setting", screen: "settings" },
];

export default function Home({ active }: ScreenProps) {
  const nav = useNav();
  const { settings, t } = useSettings();
  const grid = useGridNav(ENTRIES.length);

  const open = (i: number) => {
    const entry = ENTRIES[i];
    if (!entry) return;
    nav.push(entry.screen, entry.filtered ? { commodityId: settings.foodId } : {});
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
  const food = commodity(settings.foodId);

  return (
    <Screen
      active={active}
      title={`${food.icon} Mizani`}
      sub={settings.marketId ? market(settings.marketId).name : undefined}
      soft={{ c: t("ok"), r: t("exit") }}
      onKey={onKey}
    >
      <Grid items={items} sel={grid.index} big />
      <div className="mut hint">{t("pickOne")}</div>
    </Screen>
  );
}
