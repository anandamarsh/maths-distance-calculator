import type { TFunction } from "../../i18n/types.ts";
import { createQuestionId, createSingleQuestion, randomInt, routeDistance } from "../shared.ts";
import type { TrailConfig, TrailQuestion } from "../types.ts";

/**
 * Standard Level 2 arithmetic: hide one leg of a forward route and solve for the
 * missing labelled distance using the total.
 */
export function createLevelTwoNormalQuestions(
  config: TrailConfig,
  count = 5,
  t: TFunction,
  random: () => number = Math.random,
): TrailQuestion[] {
  const stopCount = config.stops.length;
  const questions: TrailQuestion[] = [];
  const seenQuestions = new Set<string>();
  let attempts = 0;

  while (questions.length < count && attempts < 300) {
    attempts += 1;
    const maxHops = Math.min(stopCount - 1, 5);
    if (maxHops < 2) {
      continue;
    }

    const hopCount = randomInt(2, maxHops, random);
    const maxStart = stopCount - 1 - hopCount;
    if (maxStart < 0) {
      continue;
    }

    const start = randomInt(0, maxStart, random);
    const route = Array.from({ length: hopCount + 1 }, (_, index) => start + index);
    const routeEdgeIndices = route.slice(0, -1).map((stopIndex) => stopIndex);
    const hiddenEdge = routeEdgeIndices[randomInt(0, routeEdgeIndices.length - 1, random)];

    const signature = `${route.join("-")}-h${hiddenEdge}`;
    if (seenQuestions.has(signature)) {
      continue;
    }
    seenQuestions.add(signature);

    const total = routeDistance(route, config.edges);
    const from = config.stops[route[0]].label;
    const to = config.stops[route[route.length - 1]].label;
    const hidFrom = config.stops[hiddenEdge].label;
    const hidTo = config.stops[hiddenEdge + 1].label;
    const promptVars = { from, to, total: String(Math.round(total)), unit: config.unit, hidFrom, hidTo };

    questions.push({
      id: createQuestionId("q2", questions.length + 1),
      route,
      prompt: t("game.prompt.l2MissingLeg", promptVars),
      promptKey: "game.prompt.l2MissingLeg",
      promptVars,
      answer: config.edges[hiddenEdge].distance,
      hiddenEdge,
      totalGiven: total,
    });
  }

  return questions;
}

export function createLevelTwoNormalQuestion(
  config: TrailConfig,
  t: TFunction,
  random: () => number = Math.random,
): TrailQuestion {
  return createSingleQuestion(
    createLevelTwoNormalQuestions(config, 1, t, random),
    "Could not build a Level 2 Trail Distances question.",
  );
}
