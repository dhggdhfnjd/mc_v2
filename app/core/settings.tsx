"use client";

// Per-device settings. On Cloud Phone, localStorage lives on CloudMosa's servers, encrypted
// with a device key, and survives until the user picks "Clear data" — good enough for an
// anonymous profile; the ledger would additionally sync to the API once a phone number is linked.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { setNetwork, type NetworkMode } from "../lib/api";
import { translate, type Lang, type TKey } from "./i18n";

export interface Settings {
  lang: Lang;
  marketId: string | null;
  favorites: string[];
  network: NetworkMode;
  /** the food the three filtered views are showing; set by every food pick */
  foodId: string;
}

const DEFAULTS: Settings = { lang: "en", marketId: null, favorites: ["maize", "beans"], network: "ok", foodId: "maize" };
const STORAGE_KEY = "mz.v1.settings";

interface SettingsApi {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  toggleFavorite: (commodityId: string) => void;
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
  const toggleFavorite = useCallback(
    (id: string) =>
      setSettings((s) => ({
        ...s,
        favorites: s.favorites.includes(id) ? s.favorites.filter((f) => f !== id) : [...s.favorites, id],
      })),
    [],
  );
  const bump = useCallback(() => setDataVersion((v) => v + 1), []);
  const t = useCallback((key: TKey) => translate(settings.lang, key), [settings.lang]);

  const value = useMemo(
    () => ({ settings, update, toggleFavorite, t, dataVersion, bump }),
    [settings, update, toggleFavorite, t, dataVersion, bump],
  );
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsApi {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used inside SettingsProvider");
  return ctx;
}
