"use client";

// Global key bus. Exactly one screen (the top of the stack) owns the keys at any time.
// A screen's handler returns true when it consumed the key; an unconsumed right soft key
// falls through to "go back".

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";
import { fromKeyboard, type Key } from "./keypad";
import { useNav } from "./router";

export type KeyHandler = (key: Key) => boolean | void;

interface KeyBus {
  register: (handler: KeyHandler) => () => void;
  /** also used by the on-screen keypad of the desktop phone frame */
  press: (key: Key) => void;
}

const KeyContext = createContext<KeyBus | null>(null);

export function KeyProvider({ children }: { children: ReactNode }) {
  const nav = useNav();
  const handler = useRef<KeyHandler | null>(null);
  const navRef = useRef(nav);
  navRef.current = nav;

  const register = useCallback((h: KeyHandler) => {
    handler.current = h;
    return () => {
      if (handler.current === h) handler.current = null;
    };
  }, []);

  const press = useCallback((key: Key) => {
    const consumed = handler.current?.(key) === true;
    if (!consumed && key === "RSK") navRef.current.back();
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const key = fromKeyboard(e);
      if (!key) return;
      e.preventDefault();
      e.stopPropagation();
      press(key);
    };
    // Cloud Phone devices: the right soft key arrives as a cancellable "back" event.
    // Leaving it un-cancelled at the root lets the platform close the widget.
    const onBack = (e: Event) => {
      const consumed = handler.current?.("RSK") === true;
      if (consumed) {
        e.preventDefault();
      } else if (navRef.current.stack.length > 1) {
        e.preventDefault();
        navRef.current.back();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("back", onBack);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("back", onBack);
    };
  }, [press]);

  const bus = useMemo(() => ({ register, press }), [register, press]);
  return <KeyContext.Provider value={bus}>{children}</KeyContext.Provider>;
}

export function useKeyBus(): KeyBus {
  const bus = useContext(KeyContext);
  if (!bus) throw new Error("useKeyBus must be used inside KeyProvider");
  return bus;
}
