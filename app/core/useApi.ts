"use client";

// Data hook with a last-good fallback: when a call fails (flaky border-town network), the
// screen still shows what this phone saw last time, clearly marked with its date.

import { useCallback, useEffect, useState } from "react";
import { cacheGet, cachePut } from "../lib/api";
import { useSettings } from "./settings";

export interface ApiState<T> {
  data: T | null;
  /** timestamp of the cached copy when the live call failed, else null */
  staleAt: number | null;
  error: boolean;
  reload: () => void;
}

export function useApi<T>(cacheKey: string, fn: () => Promise<T>, deps: unknown[]): ApiState<T> {
  const { dataVersion } = useSettings();
  const [state, setState] = useState<{ data: T | null; staleAt: number | null; error: boolean }>({
    data: null,
    staleAt: null,
    error: false,
  });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    fn()
      .then((data) => {
        cachePut(cacheKey, data);
        if (alive) setState({ data, staleAt: null, error: false });
      })
      .catch(() => {
        if (!alive) return;
        const cached = cacheGet<T>(cacheKey);
        setState(cached ? { data: cached.data, staleAt: cached.at, error: false } : { data: null, staleAt: null, error: true });
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, dataVersion, attempt, ...deps]);

  const reload = useCallback(() => setAttempt((a) => a + 1), []);
  return { ...state, reload };
}
