"use client";

// One commodity, four clear actions. These actions are stable, so digit shortcuts coexist with
// D-pad and OK here; only product selection on Home is intentionally arrow-only.

import Screen, { type ScreenProps } from "../components/Screen";
import { Grid, useGridNav, type GridItem } from "../components/ui";
import type { TKey } from "../core/i18n";
import { isDigit, type Key } from "../core/keypad";
import { useNav, type ScreenName } from "../core/router";
import { useSettings } from "../core/settings";
import { commodity, DEFAULT_MARKET_ID, market } from "../lib/catalog";

const ACTIONS: { icon: string; label: TKey; screen: ScreenName }[] = [
  { icon: "💰", label: "nowPrice", screen: "price" },
  { icon: "🗺️", label: "buyerMap", screen: "map" },
  { icon: "📈", label: "histPrice", screen: "history" },
  { icon: "📣", label: "wantBuy", screen: "post" },
];

export default function FoodDetail({ active, params }: ScreenProps) {
  const nav = useNav();
  const { settings, t } = useSettings();
  const c = commodity((params.commodityId as string | undefined) ?? settings.foodId);
  const grid = useGridNav(ACTIONS.length, 2);

  const open = (i: number) => {
    const action = ACTIONS[i];
    if (action) nav.push(action.screen, { commodityId: c.id });
  };

  const onKey = (key: Key): boolean => {
    if (grid.onKey(key)) return true;
    if (key === "OK") return open(grid.index), true;
    if (isDigit(key) && key !== "0") {
      const i = Number(key) - 1;
      if (i < ACTIONS.length) {
        grid.setIndex(i);
        open(i);
      }
      return true;
    }
    return false;
  };

  const name = settings.lang === "sw" ? c.sw : c.en;
  const items: GridItem[] = ACTIONS.map((a) => ({ key: a.screen, icon: a.icon, label: t(a.label) }));

  return (
    <Screen
      active={active}
      title={`${c.icon} ${name}`}
      sub={market(settings.marketId ?? DEFAULT_MARKET_ID).name}
      soft={{ c: t("ok") }}
      onKey={onKey}
    >
      <Grid items={items} sel={grid.index} cols={2} big />
      <div className="mut hint">{t("numberOrArrow")}</div>
    </Screen>
  );
}
