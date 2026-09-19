"use client";

import Screen, { type ScreenProps } from "../components/Screen";
import { Hr, Row, useListNav, useNotice } from "../components/ui";
import type { Key } from "../core/keypad";
import { useNav } from "../core/router";
import { useSettings } from "../core/settings";
import { resetDemoData, type NetworkMode } from "../lib/api";
import { market } from "../lib/catalog";

const NETWORKS: NetworkMode[] = ["ok", "flaky", "down"];

export default function Settings({ active }: ScreenProps) {
  const nav = useNav();
  const { settings, update, t, bump } = useSettings();
  const list = useListNav(4);
  const [notice, show] = useNotice();

  const onKey = (key: Key): boolean => {
    if (list.onKey(key)) return true;
    const change = key === "Left" || key === "Right" || key === "OK";
    if (!change) return false;
    switch (list.index) {
      case 0:
        update({ lang: settings.lang === "en" ? "sw" : "en" });
        break;
      case 1:
        if (key === "OK") nav.push("area");
        break;
      case 2: {
        const step = key === "Left" ? NETWORKS.length - 1 : 1;
        update({ network: NETWORKS[(NETWORKS.indexOf(settings.network) + step) % NETWORKS.length] });
        break;
      }
      case 3:
        if (key === "OK") {
          resetDemoData();
          bump();
          show(t("resetDone"));
        }
        break;
    }
    return true;
  };

  return (
    <Screen active={active} title={t("settings")} soft={{ c: t("ok") }} onKey={onKey} notice={notice}>
      <Row on={list.index === 0} l={t("lang")} r={`◀ ${settings.lang === "en" ? "English" : "Kiswahili"} ▶`} />
      <Row on={list.index === 1} l={t("area")} r={settings.marketId ? market(settings.marketId).name : "–"} />
      <Row on={list.index === 2} l={t("network")} r={`◀ ${settings.network} ▶`} />
      <Row on={list.index === 3} l={t("reset")} />
      <Hr />
      <div className="mut">Mizani 0.1 · prototype · demo prices, not live market data</div>
    </Screen>
  );
}
