import { describe, expect, it } from "vitest";
import { normalizePhone, validateDemand } from "./demand";

const ok = { commodityId: "maize", marketId: "5671", kg: 100, bidC: 4000, days: 3, phone: "0700 000 111" };

describe("buyer post rules (shared by the phone and the Worker)", () => {
  it("accepts a complete post", () => {
    expect(validateDemand(ok)).toBeNull();
  });

  it("rejects unknown crops and markets, so nothing lands at a fallback coordinate", () => {
    expect(validateDemand({ ...ok, commodityId: "gold" })).toBe("badPost");
    expect(validateDemand({ ...ok, marketId: "busia-ke" })).toBe("badPost");
  });

  it("rejects amounts that are not positive whole numbers", () => {
    for (const bad of [0, -5, 1.5, Number.NaN, 2_000_000]) expect(validateDemand({ ...ok, kg: bad })).toBe("badPost");
    for (const bad of [0, 40.5, 20_000_000]) expect(validateDemand({ ...ok, bidC: bad })).toBe("badPost");
  });

  it("keeps a number public for at most three days", () => {
    expect(validateDemand({ ...ok, days: 4 })).toBe("badPost");
    expect(validateDemand({ ...ok, days: 0 })).toBe("badPost");
  });

  it("accepts phone numbers of 7–15 digits and nothing else", () => {
    expect(normalizePhone(" +254  700 000 111 ")).toBe("+254 700 000 111");
    expect(normalizePhone("123456")).toBeNull();
    expect(normalizePhone("0700-000-111")).toBeNull();
    expect(normalizePhone("1234567890123456")).toBeNull();
  });
});
