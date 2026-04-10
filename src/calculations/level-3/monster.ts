import type { TFunction } from "../../i18n/types.ts";
import type { TrailConfig, TrailQuestion } from "../types.ts";
import { createLevelThreeNormalQuestion, createLevelThreeNormalQuestions } from "./normal.ts";

/**
 * The monster round currently reuses the same hub-comparison arithmetic as the
 * normal round. The dedicated file keeps the round path explicit.
 */
export function createLevelThreeMonsterQuestions(
  config: TrailConfig,
  count = 5,
  t: TFunction,
  random: () => number = Math.random,
): TrailQuestion[] {
  return createLevelThreeNormalQuestions(config, count, t, random);
}

export function createLevelThreeMonsterQuestion(
  config: TrailConfig,
  t: TFunction,
  random: () => number = Math.random,
): TrailQuestion {
  return createLevelThreeNormalQuestion(config, t, random);
}
