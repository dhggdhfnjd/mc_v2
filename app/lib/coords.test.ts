import { describe, expect, it } from "vitest";
import { nearestMarket, parseCoord, typeCoord } from "./coords";

const type = (keys: string[], start = "") =>
  keys.reduce((s, k) => typeCoord(s, k as Parameters<typeof typeCoord>[1]) ?? s, start);

describe("typing a coordinate on a keypad", () => {
  it("types digits with * as the decimal point", () => {
    expect(type(["3", "4", "*", "1", "1"])).toBe("34.11");
  });
  it("starts a bare * as 0.", () => {
    expect(type(["*", "4", "6"])).toBe("0.46");
  });
  it("ignores a second decimal point", () => {
    expect(type(["1", "*", "2", "*", "3"])).toBe("1.23");
  });
  it("flips the sign with # at any time", () => {
    expect(type(["0", "*", "0", "9", "#"])).toBe("-0.09");
    expect(type(["#", "#"], "5")).toBe("5");
    expect(type(["#", "*", "5"])).toBe("-0.5");
  });
  it("deletes the last character", () => {
    expect(type(["Del"], "34.1")).toBe("34.");
  });
  it("leaves unrelated keys to the screen", () => {
    expect(typeCoord("1", "Up")).toBeNull();
    expect(typeCoord("1", "OK")).toBeNull();
  });
});

describe("parseCoord", () => {
  it("accepts numbers inside the limit", () => {
    expect(parseCoord("-0.0917", 90)).toBeCloseTo(-0.0917);
    expect(parseCoord("34.", 180)).toBe(34);
  });
  it("rejects out-of-range or incomplete input", () => {
    expect(parseCoord("91", 90)).toBeNull();
    expect(parseCoord("-", 90)).toBeNull();
    expect(parseCoord("", 90)).toBeNull();
  });
});

describe("nearestMarket", () => {
  it("finds Kisumu from a point just outside it", () => {
    const { market, km } = nearestMarket({ lat: -0.1, lon: 34.75 });
    expect(market.id).toBe("kisumu");
    expect(km).toBeLessThan(3);
  });
});
