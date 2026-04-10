import type { TFunction } from "../../i18n/types.ts";
import { createQuestionId, createSingleQuestion, normalize1dp, randomInt } from "../shared.ts";
import type { TrailConfig, TrailQuestion } from "../types.ts";

/**
 * Standard Level 3 arithmetic: compare the two one-edge arms on either side of a
 * shared hub and return the absolute difference.
 */
export function createLevelThreeNormalQuestions(
  config: TrailConfig,
  count = 5,
  t: TFunction,
  random: () => number = Math.random,
): TrailQuestion[] {
  const stopCount = config.stops.length;
  if (stopCount < 3) {
    return [];
  }

  const questions: TrailQuestion[] = [];
  const seenHubs = new Set<string>();
  let attempts = 0;

  while (questions.length < count && attempts < 300) {
    attempts += 1;
    const hub = randomInt(1, stopCount - 2, random);
    const edgeLeft = hub - 1;
    const edgeRight = hub;

    const signature = `h${hub}`;
    if (seenHubs.has(signature)) {
      continue;
    }
    seenHubs.add(signature);

    const distA = config.edges[edgeLeft].distance;
    const distB = config.edges[edgeRight].distance;
    if (Math.abs(distA - distB) < 0.05) {
      continue;
    }

    const hubName = config.stops[hub].label;
    const leftName = config.stops[hub - 1].label;
    const rightName = config.stops[hub + 1].label;
    const [farName, nearName, farDist, nearDist] =
      distA >= distB
        ? [leftName, rightName, distA, distB]
        : [rightName, leftName, distB, distA];
    const answer = normalize1dp(farDist - nearDist);

    const promptVars = { hub: hubName, far: farName, near: nearName };
    const promptLineVars: [Record<string, string>, Record<string, string>, Record<string, string>] = [
      { from: hubName, to: leftName },
      { from: hubName, to: rightName },
      promptVars,
    ];

    questions.push({
      id: createQuestionId("q3", questions.length + 1),
      route: [hub - 1, hub, hub + 1],
      prompt: t("game.prompt.l3HowMuchFarther", promptVars),
      promptKey: "game.prompt.l3HowMuchFarther",
      promptVars,
      answer,
      hubStop: hub,
      legA: edgeLeft,
      legB: edgeRight,
      promptLines: [
        t("game.prompt.l3SubFromTo", promptLineVars[0]),
        t("game.prompt.l3SubFromTo", promptLineVars[1]),
        t("game.prompt.l3HowMuchFarther", promptVars),
      ],
      promptLineKeys: ["game.prompt.l3SubFromTo", "game.prompt.l3SubFromTo", "game.prompt.l3HowMuchFarther"],
      promptLineVars,
      subAnswers: [distA, distB, answer],
    });
  }

  return questions;
}

export function createLevelThreeNormalQuestion(
  config: TrailConfig,
  t: TFunction,
  random: () => number = Math.random,
): TrailQuestion {
  return createSingleQuestion(
    createLevelThreeNormalQuestions(config, 1, t, random),
    "Could not build a Level 3 Trail Distances question.",
  );
}
