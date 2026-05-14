import { describe, expect, test } from "bun:test";
import { pickVariant } from "./ab-router.ts";

const EXP = {
  slug: "test-exp",
  variants: [
    { styleSlug: "a", weight: 50 },
    { styleSlug: "b", weight: 50 },
  ],
};

describe("pickVariant", () => {
  test("returns a known variant slug", () => {
    const result = pickVariant(EXP, "user-1");
    expect(["a", "b"]).toContain(result);
  });

  test("same userId always gets same variant (deterministic)", () => {
    const r1 = pickVariant(EXP, "user-42");
    const r2 = pickVariant(EXP, "user-42");
    expect(r1).toBe(r2);
  });

  test("different userIds can get different variants", () => {
    const results = new Set(
      Array.from({ length: 20 }, (_, i) => pickVariant(EXP, `user-${i}`)),
    );
    expect(results.size).toBeGreaterThan(1);
  });

  test("100% weight on one variant always returns it", () => {
    const exp = {
      slug: "one-sided",
      variants: [{ styleSlug: "only", weight: 100 }],
    };
    for (let i = 0; i < 50; i++) {
      expect(pickVariant(exp, `u${i}`)).toBe("only");
    }
  });

  test("distribution is roughly proportional to weights", () => {
    const exp = {
      slug: "weighted",
      variants: [
        { styleSlug: "heavy", weight: 80 },
        { styleSlug: "light", weight: 20 },
      ],
    };
    const counts: Record<string, number> = { heavy: 0, light: 0 };
    for (let i = 0; i < 500; i++) {
      counts[pickVariant(exp, String(i))]++;
    }
    // heavy should win ~80% of the time — allow ±10% slack
    expect(counts.heavy).toBeGreaterThan(300);
    expect(counts.light).toBeLessThan(200);
  });

  test("throws on empty variants", () => {
    expect(() => pickVariant({ slug: "x", variants: [] }, "u")).toThrow();
  });

  test("throws on zero total weight", () => {
    expect(() =>
      pickVariant(
        { slug: "x", variants: [{ styleSlug: "a", weight: 0 }] },
        "u",
      ),
    ).toThrow();
  });

  test("numeric userId is treated same as its string equivalent", () => {
    const byStr = pickVariant(EXP, "123");
    const byNum = pickVariant(EXP, 123);
    expect(byStr).toBe(byNum);
  });
});
