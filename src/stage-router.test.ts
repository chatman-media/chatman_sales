import { describe, expect, test } from "bun:test";
import { nextStage } from "./stage-router.ts";

describe("nextStage — objection keywords", () => {
  for (const word of [
    "но",
    "боюсь",
    "развод",
    "обман",
    "не уверен",
    "страшно",
  ]) {
    test(`"${word}" → objection`, () => {
      expect(
        nextStage({
          turnNumber: 3,
          currentStage: "qualify",
          lastUserMessage: word,
        }),
      ).toBe("objection");
    });
  }
});

describe("nextStage — pitch keywords", () => {
  for (const word of [
    "сколько",
    "зарплата",
    "вакансии",
    "контракт",
    "виза",
    "условия",
  ]) {
    test(`"${word}" → pitch`, () => {
      expect(
        nextStage({
          turnNumber: 3,
          currentStage: "qualify",
          lastUserMessage: word,
        }),
      ).toBe("pitch");
    });
  }
});

describe("nextStage — agreement → close", () => {
  for (const stage of ["pitch", "qualify", "objection"] as const) {
    test(`"давай" from ${stage} → close`, () => {
      expect(
        nextStage({
          turnNumber: 5,
          currentStage: stage,
          lastUserMessage: "давай",
        }),
      ).toBe("close");
    });
  }
  test("agreement from opener does NOT go to close", () => {
    const result = nextStage({
      turnNumber: 5,
      currentStage: "opener",
      lastUserMessage: "ок",
    });
    expect(result).not.toBe("close");
  });
});

describe("nextStage — turn 1 fallback", () => {
  test("turn 1, null stage → opener", () => {
    expect(
      nextStage({
        turnNumber: 1,
        currentStage: null,
        lastUserMessage: "привет",
      }),
    ).toBe("opener");
  });
  test("turn 1, existing stage preserved", () => {
    expect(
      nextStage({
        turnNumber: 1,
        currentStage: "qualify",
        lastUserMessage: "привет",
      }),
    ).toBe("qualify");
  });
});

describe("nextStage — stage progression", () => {
  test("opener → qualify on turn 2", () => {
    expect(
      nextStage({
        turnNumber: 2,
        currentStage: "opener",
        lastUserMessage: "интересно",
      }),
    ).toBe("qualify");
  });
  test("qualify stays on qualifier pattern", () => {
    expect(
      nextStage({
        turnNumber: 3,
        currentStage: "qualify",
        lastUserMessage: "мне 23 года, из Москвы",
      }),
    ).toBe("qualify");
  });
  test("close stays close", () => {
    expect(
      nextStage({
        turnNumber: 8,
        currentStage: "close",
        lastUserMessage: "думаю",
      }),
    ).toBe("close");
  });
});

describe("nextStage — Cyrillic Unicode boundary", () => {
  test("objection keyword inside sentence matches", () => {
    expect(
      nextStage({
        turnNumber: 3,
        currentStage: "qualify",
        lastUserMessage: "мне кажется это развод какой-то",
      }),
    ).toBe("objection");
  });
  test("pricing keyword inside sentence matches", () => {
    expect(
      nextStage({
        turnNumber: 3,
        currentStage: "qualify",
        lastUserMessage: "а сколько там платят?",
      }),
    ).toBe("pitch");
  });
});
