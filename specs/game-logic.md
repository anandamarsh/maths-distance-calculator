# Game Logic

**Primary facade:** `src/game/levelOne.ts`

Trail Distances now keeps its answer-generation rules in `src/calculations/` so
the arithmetic and route logic can be reviewed and tested level by level and
round by round.

## Folder structure

```text
src/
  calculations/
    level-1/
      normal.ts
      monster.ts
    level-2/
      normal.ts
      monster.ts
    level-3/
      normal.ts
      monster.ts
    shared.ts
    trailConfig.ts
    types.ts
  game/
    levelOne.ts
```

The screen still imports from `src/game/levelOne.ts`. That file is now a facade
that dispatches into the specific calculation module for the current level and
round.

## Core types

`src/calculations/types.ts` owns the reviewable types used by every calculator:

```ts
export interface TrailStop { id: string; label: string; x: number; y: number; }
export interface TrailEdge { from: string; to: string; distance: number; }
export interface TrailConfig { id: string; unit: "km" | "mi"; palette: ...; stops: TrailStop[]; edges: TrailEdge[]; }
export interface TrailQuestion {
  id: string;
  route: number[];
  prompt: string;
  promptKey: string;
  promptVars: Record<string, string | number>;
  answer: number;
  hiddenEdge?: number;
  totalGiven?: number;
  promptLines?: [string, string, string];
  promptLineKeys?: [string, string, string];
  promptLineVars?: [Record<string, string | number>, Record<string, string | number>, Record<string, string | number>];
  subAnswers?: [number, number, number];
  hubStop?: number;
  legA?: number;
  legB?: number;
}

export type GameRound = "normal" | "monster";
```

## Shared calculation helpers

### `src/calculations/shared.ts`

Contains the pure reusable math helpers:

```ts
export function routeDistance(route: number[], edges: TrailEdge[]): number
export function buildQuestionRoute(stopCount: number, hopCount: number, random?: () => number): number[]
export function createQuestionId(prefix: string, index: number): string
```

These helpers are deterministic for a given input and are unit-tested directly.

### `src/calculations/trailConfig.ts`

Owns map generation:

```ts
export function generateTrailConfig(level?: number, locale?: string, random?: () => number): TrailConfig
```

This stays outside the level folders because it prepares the trail used by all
levels and both rounds.

## Level and round calculators

Each file exports a pure generator for one level and one round. Files whose
math is intentionally identical to another round still exist explicitly so the
folder layout mirrors the game design and can evolve later without another
refactor.

### Level 1

```ts
export function createLevelOneNormalQuestion(config: TrailConfig, dinoName: string, t: TFunction, random?: () => number): TrailQuestion
export function createLevelOneMonsterQuestion(config: TrailConfig, dinoName: string, t: TFunction, random?: () => number): TrailQuestion
```

Current maths:
- choose a route of `1..3` hops
- answer is the total distance of the route

`monster.ts` currently reuses the same arithmetic rules as `normal.ts`.

### Level 2

```ts
export function createLevelTwoNormalQuestion(config: TrailConfig, t: TFunction, random?: () => number): TrailQuestion
export function createLevelTwoMonsterQuestion(config: TrailConfig, t: TFunction, random?: () => number): TrailQuestion
```

Current maths:
- choose a forward route of `2..5` hops
- hide one leg
- answer is the hidden leg distance

`monster.ts` currently reuses the same arithmetic rules as `normal.ts`.

### Level 3

```ts
export function createLevelThreeNormalQuestion(config: TrailConfig, t: TFunction, random?: () => number): TrailQuestion
export function createLevelThreeMonsterQuestion(config: TrailConfig, t: TFunction, random?: () => number): TrailQuestion
```

Current maths:
- pick a hub stop with one arm on each side
- compare the two arm distances
- answer is the absolute difference

`monster.ts` currently reuses the same arithmetic rules as `normal.ts`.

## Facade contract

`src/game/levelOne.ts` continues to export the screen-facing API:

```ts
export function routeDistance(route: number[], edges: TrailEdge[]): number
export function generateTrailConfig(level?: number, locale?: string): TrailConfig
export function makeOneQuestion(
  config: TrailConfig,
  level: number,
  dinoName: string,
  t: TFunction,
  round?: GameRound,
): TrailQuestion
```

For compatibility, it also continues to export:

```ts
export function generateLevelOneQuestions(...)
export function generateLevelTwoQuestions(...)
export function generateLevelThreeQuestions(...)
```

Those helpers now call the matching calculation module repeatedly.

## Test strategy

Unit tests live under:

```text
tests/unit/calculations.test.ts
```

They verify:
- exact route totals from fixed edges
- deterministic Level 1, Level 2, and Level 3 question generation
- monster dispatch stays aligned with the intended level calculator
- generated trail configs respect documented structural rules

Playwright continues to verify that the visible game still runs end to end.

## Input and cheat-code contract

Trail Distances uses keypad entry for the mathematical answer, so mobile parity
is part of the game logic contract:

- `198081` must work from the on-screen keypad and start continuous autopilot.
- `197879` must work from the on-screen keypad and reveal/fill the correct
  answer before submission.
- The trigger digits must not remain in the keypad display after the cheat code
  fires.

The screen should achieve this by sharing one cheat buffer between:
- the global `keydown` listener
- the keypad `press(key)` path
