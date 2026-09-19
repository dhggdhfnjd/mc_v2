"use client";

// The first screen when nobody is signed in. A buyer post carries a name on the map, so the app
// has to know who is holding the phone before anything can be published.
//
// Two fields, no keyboard: names and passwords are typed with the multi-tap alphabet
// (core/textentry.ts), because Cloud Phone's <input> never delivers keydown. The left soft key
// goes to Register — the only other thing a new trader can want from this screen.

import { useState } from "react";
import Screen, { type ScreenProps } from "../components/Screen";
import { TextField, useNotice, useTextForm } from "../components/ui";
import { errorKey } from "../core/errors";
import type { Key } from "../core/keypad";
import { useNav } from "../core/router";
import { useSession } from "../core/session";
import { useSettings } from "../core/settings";
import { NAME_OPTS, SECRET_OPTS } from "../core/textentry";

export default function Login({ active }: ScreenProps) {
  const nav = useNav();
  const { t } = useSettings();
  const { signIn } = useSession();
  const form = useTextForm([
    { mode: "abc", opts: NAME_OPTS },
    { mode: "123", opts: SECRET_OPTS },
  ]);
  const [busy, setBusy] = useState(false);
  const [notice, show] = useNotice();

  const submit = async () => {
    const [username, password] = form.values;
    setBusy(true);
    try {
      // on success this screen unmounts: the app tree switches to the signed-in one
      await signIn(username, password);
    } catch (e) {
      show(t(errorKey(e)));
      setBusy(false);
    }
  };

  const onKey = (key: Key): boolean => {
    if (busy) return true; // one request at a time; the soft key already says so
    if (key === "LSK") return nav.push("register"), true;
    // the right soft key deletes a character on this screen instead of the usual back/exit —
    // there is nowhere to go back to at the root, and typing is the only thing this screen does
    if (key === "RSK") return form.onKey("Del");
    if (key === "OK") return void submit(), true;
    return form.onKey(key);
  };

  return (
    <Screen
      active={active}
      title="Mizani"
      sub={t("signIn")}
      soft={{ l: t("register"), c: busy ? t("working") : t("signIn"), r: t("del") }}
      onKey={onKey}
      notice={notice}
    >
      <TextField label={t("username")} state={form.states[0]} on={form.index === 0} />
      <TextField label={t("password")} state={form.states[1]} mask on={form.index === 1} />
      <div className="mut hint">{t("textHint")}</div>
    </Screen>
  );
}
