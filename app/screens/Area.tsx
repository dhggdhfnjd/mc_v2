"use client";

// S2 — pick your area (team decision D2). Asked once, remembered, shown in every header.
// Cloud Phone has no GPS and the browser runs in a data centre, so this is a manual choice.

import Screen, { type ScreenProps } from "../components/Screen";
import { Row, useListNav } from "../components/ui";
import type { Key } from "../core/keypad";
import { useNav } from "../core/router";
import { useSettings } from "../core/settings";
import { MARKETS } from "../lib/catalog";

export default function Area({ active, params }: ScreenProps) {
  const nav = useNav();
  const { settings, update, t } = useSettings();
  const start = Math.max(0, MARKETS.findIndex((m) => m.id === settings.marketId));
  const list = useListNav(MARKETS.length, start);

  const onKey = (key: Key): boolean => {
    if (list.onKey(key)) return true;
    if (key === "OK") {
      update({ marketId: MARKETS[list.index].id });
      const then = params.then as string | undefined;
      if (then) nav.replace("price", { commodityId: then });
      else nav.back();
      return true;
    }
    return false;
  };

  return (
    <Screen active={active} title={t("area")} soft={{ c: t("ok") }} onKey={onKey}>
      <div className="mut">{t("pickArea")}</div>
      {MARKETS.map((m, i) => (
        <Row key={m.id} on={i === list.index} l={m.name} r={<small>{m.country === "KE" ? "Kenya · KSh" : "Uganda · USh"}</small>} />
      ))}
    </Screen>
  );
}
