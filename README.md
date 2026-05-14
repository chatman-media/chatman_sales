# @chatman/sales

[![CI](https://github.com/chatman-media/chatman_sales/actions/workflows/ci.yml/badge.svg)](https://github.com/chatman-media/chatman_sales/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/runtime-Bun-fbf0df?logo=bun&logoColor=black)](https://bun.sh)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![powered by @chatman/rag](https://img.shields.io/badge/RAG-@chatman%2Frag-6366f1)](https://github.com/chatman-media/chatbot_rag)

**LLM-powered sales funnel engine for conversational bots.** Persona composition, funnel stage routing, A/B testing with ELO ratings, self-play evaluation, and a coach LLM that iterates on failing styles.

Built from the production sales layer of [sales-guru](https://github.com/chatman-media/sales-guru) — a Telegram recruitment bot that runs 24/7 qualifying inbound candidates for foreign work contracts.

---

## What's inside

| Module | What it does |
|--------|-------------|
| **Types** | `Style`, `FunnelStage`, `Hook`, `StageConfig` — full Zod schema for a sales persona |
| **Prompt** | `composeSystemPrompt` — builds multi-section system prompts: persona, tone, framework (AIDA/PAS/SPIN/NEPQ/Belfort), hooks, skills, stage guidance, KB context |
| **Stage router** | `nextStage` — sub-ms Unicode-aware regex router for Cyrillic + English |
| **Stage classifier** | `classifyStage` — LLM classifier with regex fallback, `{stage, confidence, source}` |
| **ELO** | `eloUpdate` / `eloUpdatePair` — standard ELO math, K=32, symmetric pairwise |
| **A/B router** | `pickVariant` — SHA-256 deterministic assignment, same user always gets same variant |
| **Skills** | 25 persuasion techniques (Cialdini × 7, Voss × 5, NLP × 3, classical sales × 5, custom × 5) |
| **Built-in styles** | 4 production-tested personas: alina-infinity, cold-direct-pas, empathetic-nepq, flirty-belfort |
| **Self-play** | `runSelfPlayMatch` — full RAG pipeline vs LLM-driven candidate; per-turn skill grading; reflect guard |
| **Pairwise** | `runPairwiseMatch` — A vs B against same persona; comparative judge; symmetric ELO update |
| **Coach** | `proposeStyleEdits` — reads losing transcripts, proposes concrete JSON edits to tone/hooks/guidance/few-shot |
| **Shadow eval** | `runShadowEval` — Wilson 95% LB on B's win rate → keep / rollback / inconclusive |
| **Skill recommender** | `rankSkillRecommendations` — Wilson LB ranking; draws count as 0.5 wins |

---

## Install

```bash
bun add @chatman/sales     # Bun
npm install @chatman/sales # npm / pnpm / yarn
```

Peer dependency: [`@chatman/rag`](https://github.com/chatman-media/chatbot_rag) for `ChatClient`, `EmbeddingClient`, `IKbStore`, and `answerWithRag`.

---

## Quick start — compose a prompt

```typescript
import { composeSystemPrompt, getStyleOrThrow } from "@chatman/sales";

const style = getStyleOrThrow("alina-infinity-v1");

const prompt = composeSystemPrompt(style, "qualify", kbContext, {
  userFacts: { city: "Москва", age: "24" },
  skills: attachedSkills,
});
```

## Stage routing

```typescript
import { nextStage, classifyStage } from "@chatman/sales";

// Fast regex (zero cost):
const stage = nextStage({ turnNumber: 3, currentStage: "qualify", lastUserMessage: msg });

// LLM with regex fallback:
const result = await classifyStage({ chat, userMessage: msg, currentStage: stage, turnNumber: 3 });
console.log(result.stage, result.confidence, result.source); // "pitch" 0.87 "llm"
```

## A/B testing with ELO

```typescript
import { pickVariant, eloUpdate } from "@chatman/sales";

// Deterministic assignment — same user always gets same style:
const styleSlug = pickVariant(
  { slug: "summer-2025", variants: [
    { styleSlug: "alina-infinity-v1", weight: 50 },
    { styleSlug: "empathetic-nepq-v1", weight: 50 },
  ]},
  userId,
);

// Update ELO after a match:
const newRating = eloUpdate(currentRating, "won"); // K=32, baseline=1500
```

## Self-play evaluation

```typescript
import { runSelfPlayMatch, CANDIDATE_PERSONAS } from "@chatman/sales";

const result = await runSelfPlayMatch(deps, {
  style: myStyle,
  styleId: 42,
  persona: CANDIDATE_PERSONAS.find(p => p.slug === "skeptic-anya")!,
  maxTurns: 20,
});

console.log(result.outcome);          // "won" | "lost" | "draw"
console.log(result.transcript);       // full back-and-forth
console.log(result.skillsAttributed); // which skills the bot actually used
console.log(result.fabricationsCaught); // reflect guard catches
```

## Coach LLM

```typescript
import { proposeStyleEdits, applyEditsToStyle } from "@chatman/sales";

const proposal = await proposeStyleEdits({ style, matchesRepo, chat });
console.log(proposal.summary);   // "Bot too formal with price-sensitive personas"
console.log(proposal.edits);     // { voice_tone: "...", hooks_add: [...] }
console.log(proposal.rationale); // per-edit explanation

// Pure merge — returns new Style, nothing persisted:
const improved = applyEditsToStyle(style, proposal.edits);
```

## Storage interfaces

All DB-heavy modules accept injected interfaces — no ORM dependency:

```typescript
import type { ISelfPlayMatchesRepo, ISkillsRepo, IStyleRatingsRepo } from "@chatman/sales";

// Implement for your DB (Postgres, SQLite, in-memory):
class MyMatchesRepo implements ISelfPlayMatchesRepo {
  async insert(match) { /* ... */ }
  async byId(id) { /* ... */ }
  async list(opts) { /* ... */ }
}
```

---

## Built-in styles

| Slug | Persona | Framework | Voice |
|------|---------|-----------|-------|
| `alina-infinity-v1` | Алина, INFINITY AGENCY | NEPQ | Human recruiter, Telegram-native, warm |
| `cold-direct-pas-v1` | Менеджер | PAS | Direct, no fluff, fast pitch |
| `empathetic-nepq-v1` | Наталья | NEPQ | Warm, anxiety-aware, unhurried |
| `flirty-belfort-v1` | Алина | Straight Line | Assertive, playful, confident |

## Persuasion skills

25 atomic techniques from Cialdini, Voss, NLP, and classical sales — each with a `promptFragment` injected into the system prompt and an `applicableStages` filter:

```typescript
import { SKILL_CATALOGUE, SKILL_BY_SLUG } from "@chatman/sales";

const mirroring = SKILL_BY_SLUG.get("mirroring");
// { slug: "mirroring", family: "voss", promptFragment: "...", applicableStages: ["qualify", "objection"] }
```

---

## Architecture

```
@chatman/sales
├── types.ts          Style / FunnelStage / Hook schemas (zod)
├── prompt.ts         System prompt composition
├── stage-router.ts   Regex funnel stage router
├── stage-classifier.ts  LLM stage classifier
├── elo.ts            ELO rating engine
├── ab-router.ts      Deterministic A/B picker
├── skills/
│   └── catalogue.ts  25 persuasion techniques
├── styles/
│   └── *.ts          4 built-in personas
├── self-play/
│   ├── personas.ts   8 candidate archetypes
│   ├── judge.ts      LLM match judge
│   ├── orchestrator.ts  Full match loop
│   └── pairwise.ts   Head-to-head comparison
├── coach.ts          Style iteration from losses
├── shadow-eval.ts    Wilson-LB A/B shadow runner
├── skill-recommendations.ts  Wilson LB skill ranker
└── store.ts          Storage interfaces (IKbStore, ISelfPlayMatchesRepo, …)
```

Depends on [`@chatman/rag`](https://github.com/chatman-media/chatbot_rag) for `ChatClient`, `EmbeddingClient`, `IKbStore`, `answerWithRag`, and `gradeSkills`.

---

## License

[MIT](LICENSE) — Alexander Kireev / [chatman-media](https://github.com/chatman-media)
