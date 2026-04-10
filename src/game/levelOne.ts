import type { TFunction } from "../i18n/types.ts";
import { createLevelOneMonsterQuestion, createLevelOneMonsterQuestions } from "../calculations/level-1/monster.ts";
import { createLevelOneNormalQuestion, createLevelOneNormalQuestions } from "../calculations/level-1/normal.ts";
import { createLevelTwoMonsterQuestion, createLevelTwoMonsterQuestions } from "../calculations/level-2/monster.ts";
import { createLevelTwoNormalQuestion, createLevelTwoNormalQuestions } from "../calculations/level-2/normal.ts";
import { createLevelThreeMonsterQuestion, createLevelThreeMonsterQuestions } from "../calculations/level-3/monster.ts";
import { createLevelThreeNormalQuestion, createLevelThreeNormalQuestions } from "../calculations/level-3/normal.ts";
import { routeDistance } from "../calculations/shared.ts";
import { generateTrailConfig } from "../calculations/trailConfig.ts";
import type { GameRound, TrailConfig, TrailEdge, TrailQuestion, TrailStop } from "../calculations/types.ts";

/**
 * Stable screen-facing facade. The reviewable maths now lives under
 * `src/calculations/`, split by level and round.
 */
export function makeOneQuestion(
  config: TrailConfig,
  level: number,
  dinoName = "Rex",
  t: TFunction,
  round: GameRound = "normal",
): TrailQuestion {
  if (level === 2) {
    return round === "monster"
      ? createLevelTwoMonsterQuestion(config, t)
      : createLevelTwoNormalQuestion(config, t);
  }

  if (level === 3) {
    return round === "monster"
      ? createLevelThreeMonsterQuestion(config, t)
      : createLevelThreeNormalQuestion(config, t);
  }

  return round === "monster"
    ? createLevelOneMonsterQuestion(config, dinoName, t)
    : createLevelOneNormalQuestion(config, dinoName, t);
}

export function generateLevelOneQuestions(
  config: TrailConfig,
  count = 5,
  dinoName = "Rex",
  t: TFunction,
  round: GameRound = "normal",
): TrailQuestion[] {
  return round === "monster"
    ? createLevelOneMonsterQuestions(config, count, dinoName, t)
    : createLevelOneNormalQuestions(config, count, dinoName, t);
}

export function generateLevelTwoQuestions(
  config: TrailConfig,
  count = 5,
  t: TFunction,
  round: GameRound = "normal",
): TrailQuestion[] {
  return round === "monster"
    ? createLevelTwoMonsterQuestions(config, count, t)
    : createLevelTwoNormalQuestions(config, count, t);
}

export function generateLevelThreeQuestions(
  config: TrailConfig,
  count = 5,
  t: TFunction,
  round: GameRound = "normal",
): TrailQuestion[] {
  return round === "monster"
    ? createLevelThreeMonsterQuestions(config, count, t)
    : createLevelThreeNormalQuestions(config, count, t);
}

export { generateTrailConfig, routeDistance };
export type { GameRound, TrailConfig, TrailEdge, TrailQuestion, TrailStop };
