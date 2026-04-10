import type { TFunction } from "../../i18n/types.ts";
import { buildL1Prompt, buildQuestionRoute, createQuestionId, createSingleQuestion, randomInt, routeDistance } from "../shared.ts";
import type { TrailConfig, TrailQuestion } from "../types.ts";

/**
 * Standard Level 1 arithmetic: add the distances across a short adjacent route.
 */
export function createLevelOneNormalQuestions(
  config: TrailConfig,
  count = 5,
  dinoName = "Rex",
  t: TFunction,
  random: () => number = Math.random,
): TrailQuestion[] {
  const questions: TrailQuestion[] = [];
  const seenRoutes = new Set<string>();
  let attempts = 0;

  while (questions.length < count && attempts < 300) {
    attempts += 1;
    const hops = randomInt(1, Math.min(3, config.stops.length - 1), random);
    const route = buildQuestionRoute(config.stops.length, hops, random);
    const signature = route.join("-");
    if (seenRoutes.has(signature)) {
      continue;
    }
    seenRoutes.add(signature);
    const { prompt, key: promptKey, vars: promptVars } = buildL1Prompt(route, config.stops, dinoName, t);
    questions.push({
      id: createQuestionId("q1", questions.length + 1),
      route,
      prompt,
      promptKey,
      promptVars,
      answer: routeDistance(route, config.edges),
    });
  }

  return questions;
}

export function createLevelOneNormalQuestion(
  config: TrailConfig,
  dinoName = "Rex",
  t: TFunction,
  random: () => number = Math.random,
): TrailQuestion {
  return createSingleQuestion(
    createLevelOneNormalQuestions(config, 1, dinoName, t, random),
    "Could not build a Level 1 Trail Distances question.",
  );
}
