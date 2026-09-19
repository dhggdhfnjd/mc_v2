import { describe, expect, it } from "vitest";
import { closeDemand, getMyDemand, getPrices, postDemand } from "./api";

describe("buyer posts", () => {
  it("upserts one post per commodity without changing the market price", async () => {
    const before = await getPrices("melon", "busia-ke");
    const first = await postDemand({ commodityId: "melon", marketId: "busia-ke", kg: 100, bidC: 4000, days: 3, phone: "0700000000" });
    const edited = await postDemand({ commodityId: "melon", marketId: "kisumu", kg: 200, bidC: 4500, days: 3, phone: "0711111111" });
    const after = await getPrices("melon", "busia-ke");

    expect(edited.id).toBe(first.id);
    expect(await getMyDemand("melon")).toMatchObject({ marketId: "kisumu", kg: 200, phone: "0711111111" });
    expect(after.crowd?.medianC).toBe(before.crowd?.medianC);

    await closeDemand(first.id);
    expect(await getMyDemand("melon")).toBeNull();
  });
});
