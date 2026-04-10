import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createLevelOneMonsterQuestion } from "../../src/calculations/level-1/monster.ts";
import { createLevelOneNormalQuestion } from "../../src/calculations/level-1/normal.ts";
import { createLevelTwoNormalQuestion } from "../../src/calculations/level-2/normal.ts";
import { createLevelThreeNormalQuestion } from "../../src/calculations/level-3/normal.ts";
import { isExact1dpMatch, normalize1dp, routeDistance } from "../../src/calculations/shared.ts";
import { generateTrailConfig } from "../../src/calculations/trailConfig.ts";
import type { TrailConfig } from "../../src/calculations/types.ts";

function sequence(values: number[]): () => number {
  let index = 0;
  return () => {
    const value = values[Math.min(index, values.length - 1)] ?? 0;
    index += 1;
    return value;
  };
}

const t = (key: string, vars: Record<string, string | number> = {}) =>
  `${key}:${JSON.stringify(vars)}`;

const baseConfig: TrailConfig = {
  id: "test",
  unit: "km",
  palette: {
    bg: "#000000",
    bgGlow: "#111111",
    panel: "#222222",
    trail: "#333333",
    visited: "#444444",
    repeated: "#555555",
    node: "#666666",
    text: "#777777",
    accent: "#888888",
  },
  stops: [
    { id: "P0", label: "A", x: 0, y: 0 },
    { id: "P1", label: "B", x: 10, y: 0 },
    { id: "P2", label: "C", x: 20, y: 0 },
    { id: "P3", label: "D", x: 30, y: 0 },
    { id: "P4", label: "E", x: 40, y: 0 },
  ],
  edges: [
    { from: "P0", to: "P1", distance: 2.0 },
    { from: "P1", to: "P2", distance: 3.5 },
    { from: "P2", to: "P3", distance: 4.0 },
    { from: "P3", to: "P4", distance: 5.0 },
  ],
};

describe("Trail Distances calculations", () => {
  it("adds route distances correctly even when the route reverses", () => {
    assert.equal(routeDistance([0, 1, 2, 3], baseConfig.edges), 9.5);
    assert.equal(routeDistance([3, 2, 1], baseConfig.edges), 7.5);
  });

  it("builds a deterministic Level 1 question", () => {
    const question = createLevelOneNormalQuestion(
      baseConfig,
      "Rex",
      t,
      sequence([0.5, 0.4, 0.9, 0.9]),
    );
    assert.deepEqual(question.route, [2, 3, 4]);
    assert.equal(question.answer, 9);
    assert.equal(question.promptKey, "game.prompt.l1MultiStop");
  });

  it("keeps the Level 1 monster round on the same maths", () => {
    const question = createLevelOneMonsterQuestion(
      baseConfig,
      "Rex",
      t,
      sequence([0.5, 0.4, 0.9, 0.9]),
    );
    assert.deepEqual(question.route, [2, 3, 4]);
    assert.equal(question.answer, 9);
  });

  it("builds a deterministic Level 2 missing-leg question", () => {
    const question = createLevelTwoNormalQuestion(
      baseConfig,
      t,
      sequence([0, 0.4, 0]),
    );
    assert.deepEqual(question.route, [1, 2, 3]);
    assert.equal(question.hiddenEdge, 1);
    assert.equal(question.totalGiven, 7.5);
    assert.equal(question.answer, 3.5);
  });

  it("builds a deterministic Level 3 comparison question", () => {
    const question = createLevelThreeNormalQuestion(
      baseConfig,
      t,
      sequence([0.6]),
    );
    assert.deepEqual(question.route, [1, 2, 3]);
    assert.equal(question.hubStop, 2);
    assert.deepEqual(question.subAnswers, [3.5, 4.0, 0.5]);
    assert.equal(question.answer, 0.5);
  });

  it("matches Level 3 answers by exact one-decimal equality", () => {
    assert.equal(isExact1dpMatch(4.6, 4.6), true);
    assert.equal(isExact1dpMatch(4.7, 4.6), false);
    assert.equal(isExact1dpMatch(4.4, 4.3), false);
  });

  it("normalizes floating point one-decimal answers consistently", () => {
    const expected = normalize1dp(6.5 - 2.2);
    assert.equal(expected, 4.3);
    assert.equal(isExact1dpMatch(expected, 4.3), true);
  });

  it("builds trail configs with the documented structural rules", () => {
    const config = generateTrailConfig(2, "en", sequence(new Array(32).fill(0)));
    assert.equal(config.stops.length, 5);
    assert.equal(config.edges.length, 4);
    assert.equal(config.unit, "mi");
    assert.deepEqual(config.edges.map((edge) => edge.distance), [1.5, 1.5, 1.5, 1.5]);
  });
});
