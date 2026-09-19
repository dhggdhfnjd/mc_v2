"use client";

import { useEffect, useState } from "react";
import PhoneFrame, { type ScreenSize } from "./components/PhoneFrame";
import { KeyProvider } from "./core/keys";
import { RouterProvider, useNav, type Route } from "./core/router";
import { SessionProvider, useSession } from "./core/session";
import { SettingsProvider } from "./core/settings";
import { SCREENS } from "./screens";

/** Every screen in the stack stays mounted (hidden) so focus and typed numbers survive "Back". */
function ScreenHost() {
  const { stack } = useNav();
  return (
    <>
      {stack.map((route: Route, i) => {
        const View = SCREENS[route.name];
        const active = i === stack.length - 1;
        return (
          <div key={route.id} className="host" hidden={!active}>
            <View active={active} params={route.params} />
          </div>
        );
      })}
    </>
  );
}

/**
 * Signed out, the app is the login tree; signed in, it is the menu tree. The `key` is what makes
 * that a swap rather than a navigation: the router unmounts, so the back key can never walk from
 * Home into Login, and signing out cannot leave a screen of the previous account on the stack.
 */
function AppTree({ mode, onSize }: { mode: Mode; onSize: (size: ScreenSize) => void }) {
  const { user } = useSession();
  return (
    <RouterProvider key={user ? "in" : "out"} root={user ? "home" : "login"}>
      <KeyProvider>
        {mode.bare ? (
          <div className={`mz bare ${mode.size}`}>
            <ScreenHost />
          </div>
        ) : (
          <PhoneFrame size={mode.size} onSize={onSize}>
            <ScreenHost />
          </PhoneFrame>
        )}
      </KeyProvider>
    </RouterProvider>
  );
}

interface Mode {
  bare: boolean;
  size: ScreenSize;
}

/** A real handset (or the Cloud Phone simulator) has a tiny viewport: fill it, no chrome. */
function detectMode(): Mode {
  const q = new URLSearchParams(window.location.search);
  const small = window.innerWidth <= 330;
  const bare = q.get("frame") === "1" ? false : q.get("bare") === "1" || small;
  const size: ScreenSize = q.get("size") === "qq" || (bare && window.innerWidth <= 170) ? "qq" : "qv";
  return { bare, size };
}

export default function App() {
  const [mode, setMode] = useState<Mode | null>(null);

  useEffect(() => {
    setMode(detectMode());
    const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    // The service worker only matters for the smartphone PWA; on Cloud Phone the browser is remote.
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register(`${base}/sw.js`).catch(() => undefined);
    }
  }, []);

  if (!mode) return <div className="splash">Mizani</div>;

  return (
    <SettingsProvider>
      <SessionProvider>
        <AppTree mode={mode} onSize={(size) => setMode({ bare: false, size })} />
      </SessionProvider>
    </SettingsProvider>
  );
}
