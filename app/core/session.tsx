"use client";

// Who is signed in on this handset. The token comes from the accounts API (the Cloudflare Worker
// in worker/, or the on-device store when no API base is configured) and is kept in the same
// storage as the settings: on Cloud Phone that storage lives in CloudMosa's data centre, encrypted
// with a device key, so it survives the widget closing.
//
// The provider holds the session, never the password: the password exists only inside the call
// that hashes it.

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { currentSession, login, logout, register } from "../lib/api";
import type { Session } from "../lib/types";

interface SessionApi {
  session: Session | null;
  /** the signed-in username, or null — the app tree switches on this */
  user: string | null;
  signIn: (username: string, password: string) => Promise<void>;
  signUp: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionApi | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => {
    try {
      return currentSession();
    } catch {
      return null; // storage blocked, or prerendering: sign in again
    }
  });

  const signIn = useCallback(async (username: string, password: string) => {
    setSession(await login(username, password));
  }, []);

  const signUp = useCallback(async (username: string, password: string) => {
    setSession(await register(username, password));
  }, []);

  const signOut = useCallback(async () => {
    setSession(null); // the phone is signed out even if the network call never lands
    await logout();
  }, []);

  const value = useMemo(
    () => ({ session, user: session?.username ?? null, signIn, signUp, signOut }),
    [session, signIn, signUp, signOut],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionApi {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside SessionProvider");
  return ctx;
}
