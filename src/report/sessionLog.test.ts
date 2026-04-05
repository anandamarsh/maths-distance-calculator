// Unit tests for cumulative session logging behaviour
// Run with: npx tsx --test src/report/sessionLog.test.ts

import { describe, it } from "node:test";
import assert from "node:assert/strict";

// sessionLog uses module-level state, so import once
import {
  startSession,
  logAttempt,
  buildSummary,
  getAttemptCount,
} from "./sessionLog.js";

// Minimal stub so we don't need the full TrailConfig type at runtime
const stubConfig = {} as any;

function makeAttempt(level: 1 | 2 | 3, isCorrect: boolean) {
  return {
    config: stubConfig,
    prompt: "How far?",
    questionType: "total-distance" as const,
    level,
    routeStopNames: ["A", "B"],
    unit: "km" as const,
    correctAnswer: 10,
    childAnswer: isCorrect ? 10 : 5,
    isCorrect,
    gamePhase: "normal" as const,
    dinoName: "Rex",
  };
}

describe("sessionLog – cumulative mode", () => {
  it("fresh startSession resets all history", () => {
    startSession(); // default resetCumulative=true
    logAttempt(makeAttempt(1, true));
    logAttempt(makeAttempt(1, false));
    assert.equal(getAttemptCount(), 2);

    // Start a brand-new session (non-cumulative)
    startSession({ resetCumulative: true });
    assert.equal(getAttemptCount(), 0, "history should be cleared");
  });

  it("startSession with resetCumulative=false preserves prior attempts", () => {
    // Level 1 run: 3 questions
    startSession({ resetCumulative: true });
    logAttempt(makeAttempt(1, true));
    logAttempt(makeAttempt(1, true));
    logAttempt(makeAttempt(1, false));
    assert.equal(getAttemptCount(), 3);

    // Level 2 run: preserve cumulative, add 2 more questions
    startSession({ resetCumulative: false });
    logAttempt(makeAttempt(2, true));
    logAttempt(makeAttempt(2, true));
    assert.equal(getAttemptCount(), 5, "should have L1+L2 attempts combined");
  });

  it("buildSummary includes all cumulative attempts", () => {
    // Continue from previous test state (5 attempts: 2 correct L1 + 1 wrong L1 + 2 correct L2)
    const summary = buildSummary({
      playerName: "Tester",
      level: 2,
      normalEggs: 10,
      monsterEggs: 10,
      levelCompleted: true,
      monsterRoundCompleted: true,
    });

    assert.equal(summary.totalQuestions, 5);
    assert.equal(summary.correctCount, 4);
    assert.equal(summary.accuracy, 80);
    assert.equal(summary.attempts.length, 5);
  });

  it("question numbers are sequential across cumulative levels", () => {
    startSession({ resetCumulative: true });
    logAttempt(makeAttempt(1, true));  // Q1
    logAttempt(makeAttempt(1, true));  // Q2

    startSession({ resetCumulative: false });
    logAttempt(makeAttempt(2, true));  // Q3
    logAttempt(makeAttempt(2, false)); // Q4

    const summary = buildSummary({
      playerName: "Tester",
      level: 2,
      normalEggs: 10,
      monsterEggs: 10,
      levelCompleted: true,
      monsterRoundCompleted: false,
    });

    const nums = summary.attempts.map(a => a.questionNumber);
    assert.deepEqual(nums, [1, 2, 3, 4], "question numbers must be sequential");
  });

  it("Level 3 cumulative summary has all 3 levels worth of attempts", () => {
    startSession({ resetCumulative: true });
    logAttempt(makeAttempt(1, true));
    logAttempt(makeAttempt(1, false));

    startSession({ resetCumulative: false });
    logAttempt(makeAttempt(2, true));
    logAttempt(makeAttempt(2, true));

    startSession({ resetCumulative: false });
    logAttempt(makeAttempt(3, true));
    logAttempt(makeAttempt(3, false));
    logAttempt(makeAttempt(3, true));

    const summary = buildSummary({
      playerName: "Tester",
      level: 3,
      normalEggs: 15,
      monsterEggs: 15,
      levelCompleted: true,
      monsterRoundCompleted: true,
    });

    assert.equal(summary.totalQuestions, 7, "L1(2) + L2(2) + L3(3) = 7");
    assert.equal(summary.correctCount, 5);
    assert.equal(summary.accuracy, Math.round(5/7*100));
    // Levels in attempts
    const levels = summary.attempts.map(a => a.level);
    assert.deepEqual(levels, [1, 1, 2, 2, 3, 3, 3]);
  });
});
