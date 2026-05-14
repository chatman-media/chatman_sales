import { describe, expect, test } from "bun:test";
import {
  rankSkillRecommendations,
  wilsonLowerBound,
} from "./skill-recommendations.ts";
import type { SkillAggregate, SkillRow } from "./store.ts";

describe("wilsonLowerBound", () => {
  test("0 total → 0", () => expect(wilsonLowerBound(0, 0)).toBe(0));
  test("100% win rate returns positive lower bound", () => {
    expect(wilsonLowerBound(10, 10)).toBeGreaterThan(0.7);
  });
  test("0% win rate → 0", () => {
    expect(wilsonLowerBound(0, 10)).toBe(0);
  });
  test("50% rate, large sample → near 0.5", () => {
    expect(wilsonLowerBound(500, 1000)).toBeCloseTo(0.47, 1);
  });
  test("lower bound < observed rate", () => {
    const lb = wilsonLowerBound(7, 10);
    expect(lb).toBeLessThan(0.7);
    expect(lb).toBeGreaterThan(0);
  });
  test("more samples → tighter (higher lower bound) for same rate", () => {
    const lb10 = wilsonLowerBound(5, 10);
    const lb100 = wilsonLowerBound(50, 100);
    expect(lb100).toBeGreaterThan(lb10);
  });
});

const makeSkill = (slug: string, family = "cialdini"): SkillRow => ({
  slug,
  display_name: slug,
  family,
  prompt_fragment: "",
  applicable_stages: [],
  is_enabled: true,
});

const makeAgg = (
  slug: string,
  wins: number,
  losses: number,
  draws = 0,
): SkillAggregate => ({
  skill_slug: slug,
  wins,
  losses,
  draws,
  count: wins + losses + draws,
});

describe("rankSkillRecommendations", () => {
  test("returns empty when catalogue is empty", () => {
    expect(rankSkillRecommendations([], [])).toEqual([]);
  });

  test("filters out disabled skills", () => {
    const skill = { ...makeSkill("s1"), is_enabled: false };
    expect(rankSkillRecommendations([skill], [])).toHaveLength(0);
  });

  test("filters out noise family", () => {
    const skill = makeSkill("noise-skill", "noise");
    expect(rankSkillRecommendations([skill], [])).toHaveLength(0);
  });

  test("skill with no aggregates has count=0, NaN rate", () => {
    const [rec] = rankSkillRecommendations([makeSkill("s1")], []);
    expect(rec?.count).toBe(0);
    expect(rec?.observed_rate).toBeNaN();
    expect(rec?.confidence_lower).toBe(0);
    expect(rec?.recommended).toBe(false);
  });

  test("skill below minSamples has confidence_lower=0", () => {
    const [rec] = rankSkillRecommendations(
      [makeSkill("s1")],
      [makeAgg("s1", 3, 0)],
      { minSamples: 5 },
    );
    expect(rec?.confidence_lower).toBe(0);
  });

  test("high win-rate skill is recommended once samples met", () => {
    const [rec] = rankSkillRecommendations(
      [makeSkill("s1")],
      [makeAgg("s1", 8, 2)],
      { minSamples: 5, acceptThreshold: 0.4 },
    );
    expect(rec?.recommended).toBe(true);
  });

  test("ranks high-confidence skill above low-confidence", () => {
    const skills = [makeSkill("weak"), makeSkill("strong")];
    const aggs = [makeAgg("weak", 3, 7), makeAgg("strong", 9, 1)];
    const recs = rankSkillRecommendations(skills, aggs, { minSamples: 5 });
    expect(recs[0]?.slug).toBe("strong");
  });

  test("draws count as 0.5 wins for observed_rate", () => {
    const [rec] = rankSkillRecommendations(
      [makeSkill("s1")],
      [makeAgg("s1", 5, 5, 10)],
    );
    // wins=5, draws=10 → successCount=10, total=20 → rate=0.5
    expect(rec?.observed_rate).toBeCloseTo(0.5);
  });
});
