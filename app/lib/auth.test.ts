import { describe, expect, it } from "vitest";
import {
  hashPassword,
  newSalt,
  newToken,
  normalizeUsername,
  validatePassword,
  validateUsername,
  verifyPassword,
} from "./auth";

describe("username rules", () => {
  it("lowercases and trims, because the stored name is the primary key", () => {
    expect(normalizeUsername("  Amina_K  ")).toBe("amina_k");
  });

  it("accepts the names a trader would pick", () => {
    for (const name of ["amina", "posho_mill42", "j.otieno", "shop-2"]) {
      expect(validateUsername(name)).toBeNull();
    }
  });

  it("rejects names that are too short, too long, or not typeable on a keypad", () => {
    expect(validateUsername("ab")).toBe("userInvalid");
    expect(validateUsername("a".repeat(17))).toBe("userInvalid");
    expect(validateUsername("_leading")).toBe("userInvalid");
    expect(validateUsername("has space")).toBe("userInvalid");
    expect(validateUsername("amina!")).toBe("userInvalid");
  });

  it("checks names case-insensitively", () => {
    expect(validateUsername("AMINA")).toBeNull();
    expect(normalizeUsername("AMINA")).toBe(normalizeUsername("amina"));
  });
});

describe("password rules", () => {
  it("wants at least four characters and at most thirty-two", () => {
    expect(validatePassword("123")).toBe("passShort");
    expect(validatePassword("1234")).toBeNull();
    expect(validatePassword("x".repeat(33))).toBe("passShort");
  });
});

describe("password hashing", () => {
  it("never stores the password itself", async () => {
    const salt = newSalt();
    const stored = await hashPassword("maize2026", salt);
    expect(stored).not.toContain("maize2026");
    expect(stored.startsWith("p1$")).toBe(true);
  });

  it("verifies the right password and refuses the wrong one", async () => {
    const salt = newSalt();
    const stored = await hashPassword("1234", salt);
    expect(await verifyPassword("1234", salt, stored)).toBe(true);
    expect(await verifyPassword("1235", salt, stored)).toBe(false);
    expect(await verifyPassword("", salt, stored)).toBe(false);
  });

  it("gives two accounts with one password two different digests", async () => {
    const [a, b] = [newSalt(), newSalt()];
    expect(a).not.toBe(b);
    expect(await hashPassword("1234", a)).not.toBe(await hashPassword("1234", b));
  });

  it("is deterministic for the same salt, so a login can reproduce it", async () => {
    const salt = newSalt();
    expect(await hashPassword("1234", salt)).toBe(await hashPassword("1234", salt));
  });

  it("issues tokens that do not repeat", () => {
    const tokens = new Set(Array.from({ length: 50 }, newToken));
    expect(tokens.size).toBe(50);
  });
});
