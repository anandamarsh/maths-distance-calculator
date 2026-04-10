import type { TFunction } from "../../i18n/types.ts";
import type { TrailConfig, TrailQuestion } from "../types.ts";
import { createLevelOneNormalQuestion, createLevelOneNormalQuestions } from "./normal.ts";

/**
 * The monster round currently uses the exact same Level 1 distance arithmetic as
 * the normal round. The separate file makes that rule explicit for review.
 */
export function createLevelOneMonsterQuestions(
  config: TrailConfig,
  count = 5,
  dinoName = "Rex",
  t: TFunction,
  random: () => number = Math.random,
): TrailQuestion[] {
  return createLevelOneNormalQuestions(config, count, dinoName, t, random);
}

export function createLevelOneMonsterQuestion(
  config: TrailConfig,
  dinoName = "Rex",
  t: TFunction,
  random: () => number = Math.random,
): TrailQuestion {
  return createLevelOneNormalQuestion(config, dinoName, t, random);
}
