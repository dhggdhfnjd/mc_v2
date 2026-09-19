"use client";

// Option menu on the left soft key, as the Cloud Phone design guide describes: full screen,
// first item focused, Up/Down to move, Enter to run. Digits work as shortcuts too.

import Screen, { type ScreenProps } from "../components/Screen";
import { Row, useListNav } from "../components/ui";
import { useFeature } from "../core/features";
import type { TKey } from "../core/i18n";
import { isDigit, type Key } from "../core/keypad";
import { useNav, type ScreenName } from "../core/router";
import { useSettings } from "../core/settings";

interface Item {
  label: TKey;
  screen: ScreenName;
}

export default function Menu({ active, params }: ScreenProps) {
  const nav = useNav();
  const { t } = useSettings();
  const canPhoto = useFeature("ImageUpload");
  const commodityId = params.commodityId as string | undefined;

  const items: Item[] =
    params.scope === "crop"
      ? [
          { label: "whereSell", screen: "demands" },
          { label: "history", screen: "history" },
          { label: "season", screen: "season" },
          { label: "report", screen: "report" },
          { label: "postDemand", screen: "post" },
          { label: "ledger", screen: "ledger" },
          { label: "border", screen: "border" },
        ]
      : [
          ...(canPhoto ? [{ label: "photo", screen: "photo" } as Item] : []),
          { label: "ledger", screen: "ledger" },
          { label: "border", screen: "border" },
          { label: "area", screen: "area" },
          { label: "settings", screen: "settings" },
        ];
  const list = useListNav(items.length);

  const run = (i: number) => {
    const item = items[i];
    if (item) nav.replace(item.screen, commodityId ? { commodityId } : {});
  };

  const onKey = (key: Key): boolean => {
    if (list.onKey(key)) return true;
    if (key === "OK") return run(list.index), true;
    if (key === "LSK") return nav.back(), true;
    if (isDigit(key) && key !== "0") return run(Number(key) - 1), true;
    return false;
  };

  return (
    <Screen active={active} title={t("menu")} soft={{ c: t("ok") }} onKey={onKey}>
      {items.map((item, i) => (
        <Row key={item.label} on={i === list.index} l={`${i + 1}  ${t(item.label)}`} />
      ))}
    </Screen>
  );
}
