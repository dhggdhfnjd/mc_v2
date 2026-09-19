"use client";

// L2 — how do you want to name the food? Photo runs the recogniser; Text is the crop grid.
// (The audio option from the plan is not here: Cloud Phone gives no microphone access, so
// there is nothing to build against yet.)
//
// `then` carries the view to open once a food is known, so this screen doubles as the "Filter
// (Food)" step for MAP, NOW PRICE and HISTORY.

import Screen, { type ScreenProps } from "../components/Screen";
import { Grid, useGridNav, type GridItem } from "../components/ui";
import { useFeature } from "../core/features";
import type { TKey } from "../core/i18n";
import { isDigit, type Key } from "../core/keypad";
import { useNav, type ScreenName } from "../core/router";
import { useSettings } from "../core/settings";

interface Method {
  icon: string;
  label: TKey;
  screen: ScreenName;
}

export default function FoodInput({ active, params }: ScreenProps) {
  const nav = useNav();
  const { t } = useSettings();
  const canPhoto = useFeature("ImageUpload");
  const then = (params.then as ScreenName | undefined) ?? "food";

  const methods: Method[] = [
    ...(canPhoto ? [{ icon: "📷", label: "photo", screen: "photo" } as Method] : []),
    { icon: "🔤", label: "text", screen: "pick" },
  ];
  const grid = useGridNav(methods.length, 2);

  const open = (i: number) => {
    const m = methods[i];
    if (m) nav.replace(m.screen, { then });
  };

  const onKey = (key: Key): boolean => {
    if (grid.onKey(key)) return true;
    if (key === "OK") return open(grid.index), true;
    if (isDigit(key) && key !== "0") {
      const i = Number(key) - 1;
      if (i < methods.length) {
        grid.setIndex(i);
        open(i);
      }
      return true;
    }
    return false;
  };

  const items: GridItem[] = methods.map((m) => ({ key: m.label, icon: m.icon, label: t(m.label) }));

  return (
    <Screen active={active} title={t("food")} soft={{ c: t("ok") }} onKey={onKey}>
      <div className="mut hint">{t("pickFood")}</div>
      <Grid items={items} sel={grid.index} cols={2} big />
    </Screen>
  );
}
