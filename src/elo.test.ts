import { describe, expect, test } from "bun:test";
import {
  actualScore,
  ELO_BASELINE,
  ELO_DEFAULT_K,
  eloUpdate,
  eloUpdatePair,
  expectedScore,
} from "./elo.ts";

describe("actualScore", () => {
  test("won → 1", () => expect(actualScore("won")).toBe(1));
  test("lost → 0", () => expect(actualScore("lost")).toBe(0));
  test("draw → 0.5", () => expect(actualScore("draw")).toBe(0.5));
});

describe("expectedScore", () => {
  test("equal ratings → 0.5", () => {
    expect(expectedScore(1500, 1500)).toBeCloseTo(0.5);
  });
  test("higher self → > 0.5", () => {
    expect(expectedScore(1600, 1500)).toBeGreaterThan(0.5);
  });
  test("lower self → < 0.5", () => {
    expect(expectedScore(1400, 1500)).toBeLessThan(0.5);
  });
});

describe("eloUpdate", () => {
  test("win from baseline raises rating", () => {
    const next = eloUpdate(ELO_BASELINE, "won");
    expect(next).toBeGreaterThan(ELO_BASELINE);
  });
  test("loss from baseline lowers rating", () => {
    const next = eloUpdate(ELO_BASELINE, "lost");
    expect(next).toBeLessThan(ELO_BASELINE);
  });
  test("draw from baseline changes by less than K/2", () => {
    const next = eloUpdate(ELO_BASELINE, "draw");
    expect(Math.abs(next - ELO_BASELINE)).toBeLessThan(ELO_DEFAULT_K / 2);
  });
  test("win + loss are symmetric around baseline", () => {
    const win = eloUpdate(ELO_BASELINE, "won");
    const loss = eloUpdate(ELO_BASELINE, "lost");
    expect(win + loss).toBe(2 * ELO_BASELINE);
  });
  test("win delta ≈ K*(1-0.5) = 16 at equal ratings", () => {
    expect(eloUpdate(1500, "won")).toBe(1516);
    expect(eloUpdate(1500, "lost")).toBe(1484);
  });
  test("custom k and opponentRating respected", () => {
    const next = eloUpdate(1500, "won", { k: 16, opponentRating: 1500 });
    expect(next).toBe(1508);
  });
});

describe("eloUpdatePair", () => {
  test("symmetric: A wins → A up, B down", () => {
    const { a, b } = eloUpdatePair(1500, 1500, "won");
    expect(a).toBeGreaterThan(1500);
    expect(b).toBeLessThan(1500);
  });
  test("sum of ratings is preserved (±1 rounding)", () => {
    const { a, b } = eloUpdatePair(1500, 1500, "won");
    expect(Math.abs(a + b - 3000)).toBeLessThanOrEqual(1);
  });
  test("draw at equal ratings leaves both unchanged", () => {
    const { a, b } = eloUpdatePair(1500, 1500, "draw");
    expect(a).toBe(1500);
    expect(b).toBe(1500);
  });
  test("A wins → delta = -(B delta) within rounding", () => {
    const { a, b } = eloUpdatePair(1600, 1400, "won");
    expect(Math.abs(a - 1600 + (b - 1400))).toBeLessThanOrEqual(1);
  });
});
