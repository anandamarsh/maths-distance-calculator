import { useCallback, useEffect, useRef, useState } from "react";
import type { MutableRefObject, RefObject } from "react";
import type { PhantomPos } from "../components/PhantomHand";

const AUTOPILOT_TIMING = {
  READ_PROMPT: [700, 1300] as [number, number],
  DRAG_STEP: [70, 120] as [number, number],
  BEFORE_ANSWER: [1000, 1800] as [number, number],
  BETWEEN_KEYS: [220, 420] as [number, number],
  BEFORE_SUBMIT: [280, 540] as [number, number],
  BEFORE_EMAIL: [1800, 2600] as [number, number],
  BETWEEN_EMAIL_CHARS: [10, 22] as [number, number],
  BEFORE_SEND: [500, 900] as [number, number],
  AFTER_SEND: [2200, 3200] as [number, number],
} as const;
const POST_SEND_RESULT_PAUSE_MS = 2000;

const IS_AUTOMATED_BROWSER =
  typeof navigator !== "undefined" && navigator.webdriver;
const WRONG_ANSWER_RATE = IS_AUTOMATED_BROWSER ? 0.05 : 0.2;
const AUTOPILOT_SPEED_MULTIPLIER = IS_AUTOMATED_BROWSER ? 0.02 : 0.25;

function rand([low, high]: [number, number]): number {
  return Math.max(
    8,
    Math.round((low + Math.random() * (high - low)) * AUTOPILOT_SPEED_MULTIPLIER),
  );
}

function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function getAutopilotElement(key: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-autopilot-key="${key}"]`);
}

function makeWrongAnswer(correctAnswer: string): string {
  const numeric = Number.parseFloat(correctAnswer);
  if (!Number.isFinite(numeric)) {
    return correctAnswer;
  }
  const deltas = [-0.4, -0.3, -0.2, -0.1, 0.1, 0.2, 0.3, 0.4];
  const shifted = deltas
    .map((delta) => Number((numeric + delta).toFixed(1)))
    .filter((value) => value >= 0 && value !== numeric);
  return String(shifted[Math.floor(Math.random() * shifted.length)] ?? numeric + 0.1);
}

export interface ModalAutopilotControls {
  appendChar: (char: string) => void;
  setEmail: (value: string) => void;
  triggerSend: () => Promise<void> | void;
}

export interface DistanceAutopilotCallbacks {
  clearKeypad: () => void;
  expandKeypad: () => void;
  setDragging: (dragging: boolean) => void;
  teleportRex: (km: number) => void;
  moveRex: (km: number) => void;
  getScreenPointForKm: (km: number) => { x: number; y: number } | null;
  submitAnswer: () => void;
  goNextLevel: () => void;
  emailModalControls: MutableRefObject<ModalAutopilotControls | null>;
  onAutopilotComplete?: () => void;
}

export interface DistanceAutopilotState {
  screen: "playing" | "won" | "gameover";
  level: 1 | 2 | 3;
  showMonsterAnnounce: boolean;
  roundKey: number;
  answerStepKey: string;
  routeKmPoints: number[];
  targetAnswer: string;
  shouldDragRoute: boolean;
  allowWrongAnswer: boolean;
  levelCompleteVisible: boolean;
  hasNextLevel: boolean;
}

interface UseDistanceAutopilotArgs {
  callbacksRef: RefObject<DistanceAutopilotCallbacks | null>;
  autopilotEmail: string;
  state: DistanceAutopilotState;
}

export function useDistanceAutopilot({
  callbacksRef,
  autopilotEmail,
  state,
}: UseDistanceAutopilotArgs) {
  const [isActive, setIsActive] = useState(false);
  const [phantomPos, setPhantomPos] = useState<PhantomPos | null>(null);
  const runIdRef = useRef(0);
  const lastRoundKeyRef = useRef<number | null>(null);
  const lastAnswerStepKeyRef = useRef<string | null>(null);
  const lastLevelCompleteKeyRef = useRef<string | null>(null);

  const moveHand = useCallback((
    x: number,
    y: number,
    isClicking = false,
    anchor: "center" | "fingertip" = "fingertip",
  ) => {
    setPhantomPos({ x, y, isClicking, anchor });
  }, []);

  const clickElement = useCallback(
    async (key: string) => {
      const element = getAutopilotElement(key);
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      moveHand(rect.left + rect.width / 2, rect.top + rect.height / 2, false, "fingertip");
      await waitMs(120);
      moveHand(rect.left + rect.width / 2, rect.top + rect.height / 2, true, "fingertip");
      await waitMs(120);
      element.click();
      moveHand(rect.left + rect.width / 2, rect.top + rect.height / 2, false, "fingertip");
      return true;
    },
    [moveHand],
  );

  const driveRoute = useCallback(async (routeKmPoints: number[]) => {
    const callbacks = callbacksRef.current;
    if (!callbacks || routeKmPoints.length < 2) return;

    callbacks.teleportRex(routeKmPoints[0]);
    callbacks.setDragging(true);
    for (let segmentIndex = 1; segmentIndex < routeKmPoints.length; segmentIndex += 1) {
      const start = routeKmPoints[segmentIndex - 1];
      const end = routeKmPoints[segmentIndex];
      const distance = Math.abs(end - start);
      const steps = Math.max(10, Math.ceil(distance / 0.18));

      for (let step = 1; step <= steps; step += 1) {
        const km = start + ((end - start) * step) / steps;
        const point = callbacks.getScreenPointForKm(km);
        if (point) moveHand(point.x, point.y, false, "center");
        callbacks.moveRex(km);
        await waitMs(rand(AUTOPILOT_TIMING.DRAG_STEP));
      }
    }
    callbacks.setDragging(false);
  }, [callbacksRef, moveHand]);

  const typeAnswer = useCallback(async (targetAnswer: string, allowWrongAnswer: boolean) => {
    const callbacks = callbacksRef.current;
    if (!callbacks) return;

    callbacks.expandKeypad();
    callbacks.clearKeypad();
    await waitMs(160);

    const answerToType =
      allowWrongAnswer && Math.random() < WRONG_ANSWER_RATE
        ? makeWrongAnswer(targetAnswer)
        : targetAnswer;

    for (const char of answerToType) {
      await clickElement(char);
      await waitMs(rand(AUTOPILOT_TIMING.BETWEEN_KEYS));
    }

    await waitMs(rand(AUTOPILOT_TIMING.BEFORE_SUBMIT));
    const clicked = await clickElement("submit");
    if (!clicked) {
      callbacks.submitAnswer();
    }
    setPhantomPos(null);
  }, [callbacksRef, clickElement]);

  const runQuestion = useCallback(async (questionState: DistanceAutopilotState, answerOnly: boolean) => {
    if (!answerOnly && questionState.shouldDragRoute) {
      await waitMs(rand(AUTOPILOT_TIMING.READ_PROMPT));
      await driveRoute(questionState.routeKmPoints);
    }
    await waitMs(rand(AUTOPILOT_TIMING.BEFORE_ANSWER));
    await typeAnswer(questionState.targetAnswer, questionState.allowWrongAnswer);
  }, [driveRoute, typeAnswer]);

  const runLevelComplete = useCallback(async (completeState: DistanceAutopilotState) => {
    const callbacks = callbacksRef.current;
    if (!callbacks) return;

    await waitMs(rand(AUTOPILOT_TIMING.BEFORE_EMAIL));
    const input = getAutopilotElement("email-input");
    if (input) {
      const rect = input.getBoundingClientRect();
      moveHand(rect.left + rect.width / 2, rect.top + rect.height / 2, false, "fingertip");
      await waitMs(120);
      moveHand(rect.left + rect.width / 2, rect.top + rect.height / 2, true, "fingertip");
      callbacks.emailModalControls.current?.setEmail("");
      await waitMs(120);
      moveHand(rect.left + rect.width / 2, rect.top + rect.height / 2, false, "fingertip");
    }

    for (const char of autopilotEmail) {
      callbacks.emailModalControls.current?.appendChar(char);
      await waitMs(rand(AUTOPILOT_TIMING.BETWEEN_EMAIL_CHARS));
    }

    await waitMs(rand(AUTOPILOT_TIMING.BEFORE_SEND));
    callbacks.emailModalControls.current?.setEmail(autopilotEmail);
    await clickElement("email-send");
    await callbacks.emailModalControls.current?.triggerSend?.();
    await waitMs(POST_SEND_RESULT_PAUSE_MS);

    await waitMs(rand(AUTOPILOT_TIMING.AFTER_SEND));
    if (completeState.hasNextLevel) {
      const clicked = await clickElement("next-level");
      if (!clicked) callbacks.goNextLevel();
    } else {
      setPhantomPos(null);
      setIsActive(false);
      runIdRef.current += 1;
      callbacks.onAutopilotComplete?.();
    }
  }, [autopilotEmail, callbacksRef, clickElement, moveHand]);

  useEffect(() => {
    if (!isActive || state.showMonsterAnnounce) return;

    const levelCompleteKey = `${state.screen}:${state.level}:${state.hasNextLevel}`;
    if (state.levelCompleteVisible && lastLevelCompleteKeyRef.current !== levelCompleteKey) {
      lastLevelCompleteKeyRef.current = levelCompleteKey;
      const runId = ++runIdRef.current;
      void (async () => {
        await runLevelComplete(state);
        if (runId !== runIdRef.current) return;
      })();
      return;
    }

    if (state.screen !== "playing") return;

    if (lastRoundKeyRef.current !== state.roundKey) {
      lastRoundKeyRef.current = state.roundKey;
      lastAnswerStepKeyRef.current = state.answerStepKey;
      const runId = ++runIdRef.current;
      void (async () => {
        await runQuestion(state, false);
        if (runId !== runIdRef.current) return;
      })();
      return;
    }

    if (lastAnswerStepKeyRef.current !== state.answerStepKey) {
      lastAnswerStepKeyRef.current = state.answerStepKey;
      const runId = ++runIdRef.current;
      void (async () => {
        await runQuestion(state, true);
        if (runId !== runIdRef.current) return;
      })();
    }
  }, [isActive, runLevelComplete, runQuestion, state]);

  const activate = useCallback(() => {
    lastRoundKeyRef.current = null;
    lastAnswerStepKeyRef.current = null;
    lastLevelCompleteKeyRef.current = null;
    runIdRef.current += 1;
    setIsActive(true);
  }, []);

  const deactivate = useCallback(() => {
    runIdRef.current += 1;
    setIsActive(false);
    setPhantomPos(null);
    callbacksRef.current?.setDragging(false);
  }, [callbacksRef]);

  return {
    isActive,
    activate,
    deactivate,
    phantomPos,
  };
}
