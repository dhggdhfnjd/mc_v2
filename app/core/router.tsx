"use client";

// Screen stack that lives on the History API. Every push adds a history entry, so the Cloud
// Phone right soft key — whose default action is history.back() — pops exactly one screen, and
// at the root there is nothing left to pop, so the platform closes the widget.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { isCloudPhone } from "./features";

/** L1 main menu, the L2 views it opens, and the L3 details under them — see docs/ARCHITECTURE.md.
 *  "login" and "register" are the signed-out tree and are never pushed from the signed-in one. */
export type ScreenName =
  | "home"
  | "photo" | "food"
  | "map" | "price" | "history" | "post"
  | "demand" | "settings" | "langsel"
  | "where" | "near" | "coords"
  | "login" | "register";

export type Params = Record<string, unknown>;

export interface Route {
  id: number;
  name: ScreenName;
  params: Params;
}

interface Nav {
  stack: Route[];
  push: (name: ScreenName, params?: Params) => void;
  replace: (name: ScreenName, params?: Params) => void;
  /** pop `steps` screens; at the root this asks the platform to close the widget */
  back: (steps?: number) => void;
  home: () => void;
}

const NavContext = createContext<Nav | null>(null);

export function RouterProvider({ children, root = "home" }: { children: ReactNode; root?: ScreenName }) {
  // The root is a prop because signing in and out swaps the whole tree: one router rooted at
  // "login", one at "home". Remounting is what clears the stack, so neither can be reached from
  // the other with the back key.
  const [stack, setStack] = useState<Route[]>(() => [{ id: 0, name: root, params: {} }]);
  const stackRef = useRef(stack);
  stackRef.current = stack;
  const nextId = useRef(1);

  useEffect(() => {
    window.history.replaceState({ mz: 0 }, "");
    // our entries are screens of one page, not scroll positions to return to
    window.history.scrollRestoration = "manual";
    const onPop = (e: PopStateEvent) => {
      const state = e.state as { mz?: number } | null;
      const depth = typeof state?.mz === "number" ? state.mz : 0;
      const have = stackRef.current.length;
      if (depth + 1 <= have) {
        setStack((s) => s.slice(0, depth + 1));
      } else {
        // Browser "forward": the popped screens held live state we cannot rebuild, so undo it.
        window.history.go(have - 1 - depth);
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const push = useCallback((name: ScreenName, params: Params = {}) => {
    window.history.pushState({ mz: stackRef.current.length }, "");
    const route = { id: nextId.current++, name, params };
    stackRef.current = [...stackRef.current, route];
    setStack(stackRef.current);
  }, []);

  const replace = useCallback((name: ScreenName, params: Params = {}) => {
    const route = { id: nextId.current++, name, params };
    stackRef.current = [...stackRef.current.slice(0, -1), route];
    setStack(stackRef.current);
  }, []);

  const back = useCallback((steps = 1) => {
    const n = Math.min(steps, stackRef.current.length - 1);
    if (n > 0) window.history.go(-n);
    // Root + right soft key = quit the widget — but only on a Cloud Phone client; a desktop or
    // smartphone browser tab should never close itself.
    else if (isCloudPhone()) window.close();
  }, []);

  const home = useCallback(() => {
    const n = stackRef.current.length - 1;
    if (n > 0) window.history.go(-n);
  }, []);

  const nav = useMemo(() => ({ stack, push, replace, back, home }), [stack, push, replace, back, home]);
  return <NavContext.Provider value={nav}>{children}</NavContext.Provider>;
}

export function useNav(): Nav {
  const nav = useContext(NavContext);
  if (!nav) throw new Error("useNav must be used inside RouterProvider");
  return nav;
}
