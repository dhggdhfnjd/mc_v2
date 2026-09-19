import { describe, expect, it } from "vitest";
import { MULTITAP_MS, emptyText, typeText, type TextState } from "./textentry";

/** press a run of keys, one every `gap` ms, starting from a fresh field */
function press(keys: string[], opts: Parameters<typeof typeText>[3] = {}, gap = 100, start?: TextState): TextState {
  let state = start ?? emptyText("abc");
  let now = 1_000;
  for (const key of keys) {
    now += gap;
    state = typeText(state, key as Parameters<typeof typeText>[1], now, opts) ?? state;
  }
  return state;
}

describe("multi-tap text entry", () => {
  it("takes the first letter of a key on one press", () => {
    expect(press(["4", "6", "8"]).text).toBe("gmt");
  });

  it("cycles the same character while the key repeats quickly", () => {
    expect(press(["2", "2"]).text).toBe("b");
    expect(press(["2", "2", "2"]).text).toBe("c");
    expect(press(["7", "7", "7", "7"]).text).toBe("s");
  });

  it("wraps past the digit at the end of a key", () => {
    expect(press(["2", "2", "2", "2"]).text).toBe("2");
    expect(press(["2", "2", "2", "2", "2"]).text).toBe("a");
  });

  it("starts a new character once the window has closed", () => {
    expect(press(["2", "2"], {}, MULTITAP_MS + 1).text).toBe("aa");
  });

  it("starts a new character when a different key is pressed", () => {
    expect(press(["6", "6", "4"]).text).toBe("ng");
  });

  it("cycles modes with * and types digits in 123", () => {
    const state = press(["2", "*", "2", "2"]);
    expect(state.mode).toBe("ABC");
    expect(state.text).toBe("aB");
    const digits = press(["*", "*", "5", "5"]);
    expect(digits.mode).toBe("123");
    expect(digits.text).toBe("55");
  });

  it("honours a restricted mode list and refuses * when there is one mode", () => {
    expect(press(["*"], { modes: ["abc", "123"] }).mode).toBe("123");
    expect(press(["*", "*"], { modes: ["abc", "123"] }).mode).toBe("abc");
    expect(typeText(emptyText("abc"), "*", 1, { modes: ["abc"] })).toBeNull();
  });

  it("stops at maxLen but still lets the last character be cycled", () => {
    const full = press(["2", "3", "4"], { maxLen: 3 });
    expect(full.text).toBe("adg");
    expect(press(["5"], { maxLen: 3 }, 100, full).text).toBe("adg");
    expect(press(["4"], { maxLen: 3 }, 100, full).text).toBe("adh");
  });

  it("deletes backwards and closes the open cycle", () => {
    const after = press(["2", "2", "Del"]);
    expect(after.text).toBe("");
    expect(after.pending).toBeNull();
    // Del on an empty field is still ours to swallow, so it never falls through as "back"
    expect(typeText(emptyText(), "Del", 1)).not.toBeNull();
  });

  it("leaves navigation keys to the screen", () => {
    for (const key of ["OK", "Up", "Down", "Left", "Right", "LSK", "RSK", "#"] as const) {
      expect(typeText(emptyText(), key, 1)).toBeNull();
    }
  });
});
