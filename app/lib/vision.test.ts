import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { COMMODITIES } from "./catalog";
import { rank } from "./vision";

const table = { scale: 100, input: 256, labels: [{ id: "tomato", vec: [1, 0, 0] }, { id: "onion", vec: [0, 1, 0] }, { id: "maize", vec: [0.6, 0.8, 0] }], negatives: [[0, 0, 1]] };

describe("ranking image embeddings against the label table", () => {
  it("orders crops by similarity and returns shares that sum to 1", () => {
    const out = rank([0.9, 0.3, 0.05], table);
    expect(out.map((c) => c.commodityId)).toEqual(["tomato", "maize", "onion"]);
    expect(out.reduce((s, c) => s + c.confidence, 0)).toBeCloseTo(1, 5);
    expect(out[0].confidence).toBeGreaterThan(0.9);
  });
  it("does not depend on the embedding's length", () => {
    expect(rank([9, 3, 0.5], table)).toEqual(rank([0.9, 0.3, 0.05], table));
  });
  it("answers 'not a crop' when the negatives outweigh every crop together", () => {
    expect(rank([0.05, 0.05, 0.99], table)).toEqual([]);
  });
  it("keeps the crop check on the text vectors when photo prototypes pick the crop", () => {
    // the photo-informed vec leans towards onion, but the gate still decides "is it a crop"
    const split = { ...table, gate: 1, labels: table.labels.map((l) => (l.id === "onion" ? { ...l, vec: [0.8, 0.6, 0], gate: l.vec } : { ...l, gate: l.vec })) };
    expect(rank([0.9, 0.3, 0.05], split)[0].commodityId).toBe("onion");
    expect(rank([0.05, 0.05, 0.99], split)).toEqual([]);
  });
  it("lets a gate factor admit crops that the negatives only slightly outweigh", () => {
    const close = [0.3, 0.4, 0.51]; // negatives ahead of maize by about 4x
    expect(rank(close, table)).toEqual([]);
    expect(rank(close, { ...table, gate: 10 }).length).toBeGreaterThan(0);
  });
  it("returns at most three candidates", () => {
    const many = { ...table, labels: [...table.labels, { id: "rice", vec: [0.5, 0.5, 0] }] };
    expect(rank([0.7, 0.7, 0], many)).toHaveLength(3);
  });
});

describe("the shipped label table", () => {
  const shipped = JSON.parse(readFileSync(join(__dirname, "../../public/models/label-embeddings.json"), "utf8")) as {
    dim: number;
    labels: { id: string; vec: number[]; gate?: number[] }[];
    negatives: number[][];
  };
  it("covers every photo-recognizable catalog item", () => {
    const shippedIds = new Set(shipped.labels.map((l) => l.id));
    expect(COMMODITIES.filter((c) => c.photo).every((c) => shippedIds.has(c.id))).toBe(true);
  });
  it("holds unit-length vectors of the model's width", () => {
    for (const vec of [...shipped.labels.flatMap((l) => [l.vec, ...(l.gate ? [l.gate] : [])]), ...shipped.negatives]) {
      expect(vec).toHaveLength(shipped.dim);
      expect(Math.hypot(...vec)).toBeCloseTo(1, 2);
    }
  });
});
