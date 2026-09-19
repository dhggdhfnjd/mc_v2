"use client";

// Per-device settings. On Cloud Phone, localStorage lives on CloudMosa's servers, encrypted
// with a device key, and survives until the user picks "Clear data" — good enough for an
// anonymous profile. A phone number is kept only to prefill the buyer-post form.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { setNetwork, type NetworkMode } from "../lib/api";
import { translate, type Lang, type TKey } from "./i18n";

export interface Settings {
  lang: Lang;
  marketId: string | null;
  network: NetworkMode;
  phone: string;
  /** where the user is when not simply "at a market": GPS (Near me) or typed coordinates.
   * null when the area was picked from the market list. marketId is then the nearest market. */
  fix: { lat: number; lon: number; accuracyM?: number; source?: "gps" | "manual" } | null;
  /** the product most recently opened */
  foodId: string;
  /** audio mode: speak a product's name when the highlight moves onto it (core/audio.ts) */
  audio: boolean;
}

const DEFAULTS: Settings = { lang: "en", marketId: null, network: "ok", phone: "", foodId: "maize", fix: null, audio: false };
const STORAGE_KEY = "mz.v2.settings";

interface SettingsApi {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  t: (key: TKey) => string;
  /** bumped after every write so screens showing derived data refresh */
  dataVersion: number;
  bump: () => void;
}

const SettingsContext = createContext<SettingsApi | null>(null);

function load(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(load);
  const [dataVersion, setDataVersion] = useState(0);

  useEffect(() => {
    setNetwork(settings.network);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      /* storage blocked: settings last for this session only */
    }
  }, [settings]);

  const update = useCallback((patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch })), []);
  const bump = useCallback(() => setDataVersion((v) => v + 1), []);
  const t = useCallback((key: TKey) => translate(settings.lang, key), [settings.lang]);

  const value = useMemo(
    () => ({ settings, update, t, dataVersion, bump }),
    [settings, update, t, dataVersion, bump],
  );
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsApi {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used inside SettingsProvider");
  return ctx;
}
