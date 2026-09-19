import { describe, expect, it } from "vitest";
import { ApiError, closeDemand, currentSession, getMyDemand, getPrices, login, logout, postDemand, register } from "./api";

describe("accounts", () => {
  it("registers, signs out and signs back in with the same name", async () => {
    const created = await register("Amina_K", "1234");
    expect(created.username).toBe("amina_k"); // stored lowercase: it is the primary key
    expect(currentSession()?.username).toBe("amina_k");

    await logout();
    expect(currentSession()).toBeNull();

    const back = await login("AMINA_K", "1234");
    expect(back.username).toBe("amina_k");
    expect(back.token).not.toBe(created.token); // signing in issues a new session row
  });

  it("refuses a taken name, a bad password and an unknown account", async () => {
    await register("otieno", "1234");
    await expect(register("Otieno", "9999")).rejects.toMatchObject({ code: "userTaken" });
    await expect(register("ab", "1234")).rejects.toMatchObject({ code: "userInvalid" });
    await expect(register("njeri", "12")).rejects.toMatchObject({ code: "passShort" });
    await expect(login("otieno", "0000")).rejects.toMatchObject({ code: "wrongLogin" });
    await expect(login("nobody", "1234")).rejects.toMatchObject({ code: "wrongLogin" });
  });
});

describe("buyer posts", () => {
  it("cannot be published without an account", async () => {
    await logout();
    await expect(postDemand({ commodityId: "melon", marketId: "busia-ke", kg: 100, bidC: 4000, days: 3, phone: "0700000000" }))
      .rejects.toBeInstanceOf(ApiError);
  });

  it("upserts one post per commodity without changing the market price", async () => {
    await register("buyer_one", "1234");
    const before = await getPrices("melon", "busia-ke");
    const first = await postDemand({ commodityId: "melon", marketId: "busia-ke", kg: 100, bidC: 4000, days: 3, phone: "0700000000" });
    const edited = await postDemand({ commodityId: "melon", marketId: "kisumu", kg: 200, bidC: 4500, days: 3, phone: "0711111111" });
    const after = await getPrices("melon", "busia-ke");

    expect(edited.id).toBe(first.id);
    expect(await getMyDemand("melon")).toMatchObject({ marketId: "kisumu", kg: 200, phone: "0711111111", username: "buyer_one" });
    expect(after.crowd?.medianC).toBe(before.crowd?.medianC);

    await closeDemand(first.id);
    expect(await getMyDemand("melon")).toBeNull();
  });
});
