"use client";

// Creating an account: the same two values as Login plus a repeat of the password, because there
// is no "show password" button to fall back on and a typo made with multi-tap is easy.
//
// The username is the primary key of the `users` table (worker/schema.sql) and the name other
// traders see on the buyer map, so it is checked here, again by the API, and finally by SQLite.

import { useState } from "react";
import Screen, { type ScreenProps } from "../components/Screen";
import { TextField, useNotice, useTextForm } from "../components/ui";
import { errorKey } from "../core/errors";
import type { Key } from "../core/keypad";
import { useNav } from "../core/router";
import { useSession } from "../core/session";
import { useSettings } from "../core/settings";
import { NAME_OPTS, SECRET_OPTS } from "../core/textentry";
import { validatePassword, validateUsername } from "../lib/auth";

export default function Register({ active }: ScreenProps) {
  const nav = useNav();
  const { t } = useSettings();
  const { signUp } = useSession();
  const form = useTextForm([
    { mode: "abc", opts: NAME_OPTS },
    { mode: "123", opts: SECRET_OPTS },
    { mode: "123", opts: SECRET_OPTS },
  ]);
  const [busy, setBusy] = useState(false);
  const [notice, show] = useNotice();

  const submit = async () => {
    const [username, password, repeat] = form.values;
    // say which field is wrong before spending a round trip on it
    const bad = validateUsername(username) ?? validatePassword(password) ?? (password === repeat ? null : "passMatch");
    if (bad) {
      form.setIndex(bad === "userInvalid" ? 0 : bad === "passShort" ? 1 : 2);
      show(t(bad));
      return;
    }
    setBusy(true);
    try {
      await signUp(username, password);
    } catch (e) {
      show(t(errorKey(e)));
      setBusy(false);
    }
  };

  const onKey = (key: Key): boolean => {
    if (busy) return true;
    if (key === "LSK") return nav.back(), true;
    // right soft key deletes a character here instead of going back — the left soft key already
    // returns to Sign in, so there is no loss of navigation, only one less way to trigger it
    if (key === "RSK") return form.onKey("Del");
    if (key === "OK") return void submit(), true;
    return form.onKey(key);
  };

  return (
    <Screen
      active={active}
      title={t("newAccount")}
      soft={{ l: t("signIn"), c: busy ? t("working") : t("register"), r: t("del") }}
      onKey={onKey}
      notice={notice}
    >
      <TextField label={t("username")} state={form.states[0]} on={form.index === 0} />
      <TextField label={t("password")} state={form.states[1]} mask on={form.index === 1} />
      <TextField label={t("repeatPass")} state={form.states[2]} mask on={form.index === 2} />
      <div className="mut hint">{t("textHint")}</div>
    </Screen>
  );
}
