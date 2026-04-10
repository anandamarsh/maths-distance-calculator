import type { TFunction } from "../../i18n/types.ts";
import type { TrailConfig, TrailQuestion } from "../types.ts";
import { createLevelTwoNormalQuestion, createLevelTwoNormalQuestions } from "./normal.ts";

/**
 * The monster round currently uses the same missing-leg maths as the normal
 * round. The dedicated file keeps the round boundary explicit.
 */
export function createLevelTwoMonsterQuestions(
  config: TrailConfig,
  count = 5,
  t: TFunction,
  random: () => number = Math.random,
): TrailQuestion[] {
  return createLevelTwoNormalQuestions(config, count, t, random);
}

export function createLevelTwoMonsterQuestion(
  config: TrailConfig,
  t: TFunction,
  random: () => number = Math.random,
): TrailQuestion {
  return createLevelTwoNormalQuestion(config, t, random);
}
