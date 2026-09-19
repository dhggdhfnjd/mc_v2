"use client";

// The frame every screen shares: header, body, soft-key bar — and the hook-up to the key bus.
// Only the active (top-of-stack) screen registers its handler.

import { useEffect, useRef, type ReactNode } from "react";
import { useKeyBus, type KeyHandler } from "../core/keys";
import { useSettings } from "../core/settings";

export interface ScreenProps {
  active: boolean;
  params: Record<string, unknown>;
}

interface Props {
  active: boolean;
  title: ReactNode;
  sub?: ReactNode;
  /** soft-key labels; the right one defaults to "Back" */
  soft?: { l?: string; c?: string; r?: string };
  onKey?: KeyHandler;
  flush?: boolean;
  notice?: string | null;
  children: ReactNode;
}

export default function Screen({ active, title, sub, soft, onKey, flush, notice, children }: Props) {
  const bus = useKeyBus();
  const { t } = useSettings();
  const latest = useRef(onKey);
  latest.current = onKey;

  useEffect(() => {
    if (!active) return;
    return bus.register((key) => latest.current?.(key));
  }, [active, bus]);

  return (
    <div className="scr">
      <header className="hd">
        <span className="hd-t">{title}</span>
        {sub ? <small>{sub}</small> : null}
      </header>
      {notice ? <div className="notice" role="status">{notice}</div> : null}
      <main className={flush ? "bd flush" : "bd"}>{children}</main>
      <footer className="sk">
        <span>{soft?.l ?? ""}</span>
        <span>{soft?.c ?? ""}</span>
        <span>{soft?.r ?? t("back")}</span>
      </footer>
    </div>
  );
}
