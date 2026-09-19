"use client";

// L3 — language and country selection. Country means the market you trade from: a manual
// choice, asked once and then shown in every header (Near me can also set it from the phone's
// location). Both lists live here because the plan draws them as one L3 leaf.

import Screen, { type ScreenProps } from "../components/Screen";
import { Row, useListNav } from "../components/ui";
import type { Lang } from "../core/i18n";
import type { Key } from "../core/keypad";
import { useNav } from "../core/router";
import { useSettings } from "../core/settings";
import { MARKETS } from "../lib/catalog";

const LANGS: { id: Lang; name: string }[] = [
  { id: "en", name: "English" },
  { id: "sw", name: "Kiswahili" },
];

export default function LangCountry({ active, params }: ScreenProps) {
  const nav = useNav();
  const { settings, update, t } = useSettings();
  const country = params.mode !== "lang";
  const start = country ? Math.max(0, MARKETS.findIndex((m) => m.id === settings.marketId)) : LANGS.findIndex((l) => l.id === settings.lang);
  const list = useListNav(country ? MARKETS.length : LANGS.length, Math.max(0, start));

  const onKey = (key: Key): boolean => {
    if (list.onKey(key)) return true;
    if (key === "OK") {
      // a city picked by hand replaces any device location
      if (country) update({ marketId: MARKETS[list.index].id, fix: null });
      else update({ lang: LANGS[list.index].id });
      nav.back(typeof params.backTo === "number" ? params.backTo : 1);
      return true;
    }
    return false;
  };

  return (
    <Screen active={active} title={country ? t("country") : t("lang")} soft={{ c: t("ok") }} onKey={onKey}>
      <div className="mut hint">{country ? t("pickArea") : t("langCountry")}</div>
      {country
        ? MARKETS.map((m, i) => (
            <Row key={m.id} on={i === list.index} l={`${i + 1}  ${m.name}`} r={<small>{m.country === "KE" ? "Kenya · KSh" : "Uganda · USh"}</small>} />
          ))
        : LANGS.map((l, i) => <Row key={l.id} on={i === list.index} l={`${i + 1}  ${l.name}`} r={l.id === settings.lang ? "✓" : undefined} />)}
    </Screen>
  );
}
