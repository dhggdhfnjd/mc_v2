// Multi-tap text entry for a keypad.
//
// Cloud Phone's <input> fires input/change but no keydown (docs/SPEC.md §5), so every field in
// Mizani is a div we draw ourselves: numbers come from `typeDigit` in keypad.ts, and names and
// passwords come from the alphabet below — press 2 twice for "b", exactly like an SMS.
//
// There is no timer anywhere in here. Which letter a press produces depends only on the previous
// press and the moment it happened, and both are already in the state, so a screen repaints once
// per key and never on its own. The caller passes `now`, which also makes this deterministic to
// test.

import { PASSWORD_MAX, USERNAME_MAX } from "../lib/auth";
import { isDigit, type Key } from "./keypad";

export type TextMode = "abc" | "ABC" | "123";

export interface TextState {
  text: string;
  mode: TextMode;
  /** the multi-tap cycle still open on the last character, if any */
  pending: { key: string; step: number; at: number } | null;
}

export interface TextOpts {
  maxLen?: number;
  /** the modes `*` cycles through; a single mode disables the `*` key */
  modes?: TextMode[];
}

/** how long the cycle on one key stays open, in ms */
export const MULTITAP_MS = 900;

/** letters first, digit last — the order every keypad phone has used since the 3310 */
const LETTERS: Record<string, string> = {
  "1": "._-1",
  "2": "abc2",
  "3": "def3",
  "4": "ghi4",
  "5": "jkl5",
  "6": "mno6",
  "7": "pqrs7",
  "8": "tuv8",
  "9": "wxyz9",
  "0": "0 ",
};

const DEFAULT_MODES: TextMode[] = ["abc", "ABC", "123"];

export const emptyText = (mode: TextMode = "abc"): TextState => ({ text: "", mode, pending: null });

const cased = (ch: string, mode: TextMode) => (mode === "ABC" ? ch.toUpperCase() : ch);

/**
 * Apply one key to a text field. Returns the next state, or null when this key is not ours —
 * the screen then gets to use it for navigation.
 */
export function typeText(state: TextState, key: Key, now: number, opts: TextOpts = {}): TextState | null {
  const maxLen = opts.maxLen ?? 16;
  const modes = opts.modes ?? DEFAULT_MODES;

  if (key === "Del") {
    return { ...state, text: state.text.slice(0, -1), pending: null };
  }
  if (key === "*") {
    if (modes.length < 2) return null;
    const next = modes[(modes.indexOf(state.mode) + 1) % modes.length];
    return { ...state, mode: next, pending: null };
  }
  if (!isDigit(key)) return null;

  if (state.mode === "123") {
    if (state.text.length >= maxLen) return { ...state, pending: null };
    return { ...state, text: state.text + key, pending: null };
  }

  const letters = LETTERS[key] ?? key;
  const open = state.pending && state.pending.key === key && now - state.pending.at < MULTITAP_MS && state.text.length > 0;
  if (open) {
    // same key again inside the window: cycle the character already on screen, never grow
    const step = (state.pending!.step + 1) % letters.length;
    return {
      ...state,
      text: state.text.slice(0, -1) + cased(letters[step], state.mode),
      pending: { key, step, at: now },
    };
  }
  if (state.text.length >= maxLen) return { ...state, pending: null };
  return {
    ...state,
    text: state.text + cased(letters[0], state.mode),
    pending: { key, step: 0, at: now },
  };
}

/** what to print in the field while it has focus, so the user can see the mode `*` will change */
export const modeLabel = (mode: TextMode): string => mode;

/** A username field. Names are stored lowercase, so offering ABC would only breed failed logins. */
export const NAME_OPTS: TextOpts = { maxLen: USERNAME_MAX, modes: ["abc", "123"] };

/** A password field. It opens on digits — a four-press PIN is the realistic choice on a keypad —
 *  but letters are one `*` away for anyone who wants them. */
export const SECRET_OPTS: TextOpts = { maxLen: PASSWORD_MAX, modes: ["123", "abc", "ABC"] };
