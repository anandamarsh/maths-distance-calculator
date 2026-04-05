// src/report/sessionLog.ts

import type { TrailConfig } from "../game/levelOne";

export interface QuestionAttempt {
  questionNumber: number;
  // Map context
  config: TrailConfig;            // full config for re-rendering the mini map
  // Question details
  prompt: string;                 // e.g. "How far from Newtown to Ashfield?"
  promptLines?: [string, string, string]; // Level 3 sub-prompts
  questionType: "total-distance" | "missing-leg" | "hub-comparison";
  level: 1 | 2 | 3;
  // Route info
  routeStopNames: string[];       // e.g. ["Newtown", "Ashfield", "Marrickville"]
  unit: "km" | "mi";
  // Answers
  correctAnswer: number;
  childAnswer: number | null;     // null if skipped (shouldn't happen but safety)
  subAnswers?: {                  // Level 3 only
    step: number;
    prompt: string;
    correctAnswer: number;
    childAnswer: number;
    isCorrect: boolean;
  }[];
  isCorrect: boolean;
  // Timing
  timestamp: number;              // Date.now() when answered
  timeTakenMs: number;            // ms from question shown to answer submitted
  // Phase
  gamePhase: "normal" | "monster";
  // Dino
  dinoName: string;
}

export interface SessionSummary {
  playerName: string;             // entered at start or "Explorer"
  level: 1 | 2 | 3;
  date: string;                   // ISO date string
  startTime: number;              // Date.now()
  endTime: number;                // Date.now()
  totalQuestions: number;
  correctCount: number;
  accuracy: number;               // 0-100
  normalEggs: number;
  monsterEggs: number;
  levelCompleted: boolean;
  monsterRoundCompleted: boolean;
  attempts: QuestionAttempt[];
}

// ─── Module-level state (NOT React state) ─────────────────────────────────

let _attempts: QuestionAttempt[] = [];
let _questionStartTime: number = Date.now();
let _sessionStartTime: number = Date.now();
let _questionCounter: number = 0;

export function startSession(opts?: { resetCumulative?: boolean }) {
  if (opts?.resetCumulative ?? true) {
    _attempts = [];
    _questionCounter = 0;
    _sessionStartTime = Date.now();
  }
  startQuestionTimer();
}

export function startQuestionTimer() {
  _questionStartTime = Date.now();
}

export function logAttempt(attempt: Omit<QuestionAttempt, "questionNumber" | "timeTakenMs" | "timestamp">) {
  _questionCounter++;
  _attempts.push({
    ...attempt,
    questionNumber: _questionCounter,
    timestamp: Date.now(),
    timeTakenMs: Date.now() - _questionStartTime,
  });
  // Reset timer for next question
  _questionStartTime = Date.now();
}

export function buildSummary(opts: {
  playerName: string;
  level: 1 | 2 | 3;
  normalEggs: number;
  monsterEggs: number;
  levelCompleted: boolean;
  monsterRoundCompleted: boolean;
}): SessionSummary {
  const correctCount = _attempts.filter(a => a.isCorrect).length;
  return {
    playerName: opts.playerName,
    level: opts.level,
    date: new Date().toISOString(),
    startTime: _sessionStartTime,
    endTime: Date.now(),
    totalQuestions: _attempts.length,
    correctCount,
    accuracy: _attempts.length > 0 ? Math.round((correctCount / _attempts.length) * 100) : 0,
    normalEggs: opts.normalEggs,
    monsterEggs: opts.monsterEggs,
    levelCompleted: opts.levelCompleted,
    monsterRoundCompleted: opts.monsterRoundCompleted,
    attempts: [..._attempts],
  };
}

export function clearSession() {
  _attempts = [];
  _questionCounter = 0;
}

export function getAttemptCount() {
  return _attempts.length;
}
