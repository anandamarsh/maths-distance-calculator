# Autopilot Mode

**Files:**
- `src/hooks/useDistanceAutopilot.ts` — engine
- `src/components/PhantomHand.tsx` — visual cursor overlay
- `src/components/AutopilotIcon.tsx` — blinking robot icon in toolbar

---

## What it does

Plays the game autonomously — dragging the dino along the route, typing decimal
answers, sending the email report, and advancing to the next level — in a loop.
Uses async/await with a run-ID cancellation pattern. Deliberately misses 20% of
answers (5% in CI/automated browser environments).

Two modes:
- **`"continuous"`** — plays indefinitely, loops back after final level
- **`"single-question"`** — drags the route + types one answer, then stops

---

## Activation

- Cheat code `198081` (on keyboard) → toggles continuous autopilot
- Cheat code `197879` → shows and submits the correct answer once (not autopilot)
- Robot button click when autopilot inactive → starts `"single-question"` mode
- Robot button click when autopilot active → stops autopilot

---

## Environment detection

```ts
const IS_AUTOMATED_BROWSER = typeof navigator !== "undefined" && navigator.webdriver;
const WRONG_ANSWER_RATE = IS_AUTOMATED_BROWSER ? 0.05 : 0.2;
const AUTOPILOT_SPEED_MULTIPLIER = IS_AUTOMATED_BROWSER ? 0.02 : 0.25;
```

When running under Playwright (`navigator.webdriver === true`):
- Wrong answer rate drops to 5% to keep tests deterministic
- All delays are multiplied by 0.02 (50× faster) so tests run quickly
- Minimum delay is always 8ms (prevents synchronous execution)

---

## Timing constants

All delays are `[lo, hi]` ranges scaled by `AUTOPILOT_SPEED_MULTIPLIER`:

```ts
const AUTOPILOT_TIMING = {
  READ_PROMPT:          [700, 1300],    // before starting to drag the route
  DRAG_STEP:            [70, 120],      // between each dino position update while dragging
  BEFORE_ANSWER:        [1000, 1800],   // pause between route completion and typing
  BETWEEN_KEYS:         [220, 420],     // between each keypad digit press
  BEFORE_SUBMIT:        [280, 540],     // pause before pressing submit
  BEFORE_EMAIL:         [1800, 2600],   // after modal appears, before starting email
  BETWEEN_EMAIL_CHARS:  [10, 22],       // between each email character
  BEFORE_SEND:          [500, 900],     // after last email char, before clicking send
  AFTER_SEND:           [2200, 3200],   // after send result, before Next Level
};

const POST_SEND_RESULT_PAUSE_MS = 2000; // fixed pause to show send result
```

`rand([lo, hi])`:
```ts
function rand([low, high]: [number, number]): number {
  return Math.max(8, Math.round((low + Math.random() * (high - low)) * AUTOPILOT_SPEED_MULTIPLIER));
}
```

---

## Wrong answer generation

```ts
function makeWrongAnswer(correctAnswer: string): string {
  const numeric = Number.parseFloat(correctAnswer);
  const deltas = [-0.4, -0.3, -0.2, -0.1, 0.1, 0.2, 0.3, 0.4];
  const shifted = deltas
    .map(delta => Number((numeric + delta).toFixed(1)))
    .filter(value => value >= 0 && value !== numeric);
  return String(shifted[Math.floor(Math.random() * shifted.length)] ?? numeric + 0.1);
}
```

Wrong answers are decimal offsets of ±0.1 to ±0.4 from the correct answer.
These are genuine misses — logged in session, counted in accuracy, never self-corrected.

---

## Interfaces

### `DistanceAutopilotCallbacks`

Must be populated by the screen every render:

```ts
export interface DistanceAutopilotCallbacks {
  clearKeypad: () => void;
  expandKeypad: () => void;
  setDragging: (dragging: boolean) => void;
  teleportRex: (km: number) => void;       // instant position set, resets odometer
  moveRex: (km: number) => void;           // smooth position update, accumulates odometer
  getScreenPointForKm: (km: number) => { x: number; y: number } | null;
  submitAnswer: () => void;
  goNextLevel: () => void;
  emailModalControls: MutableRefObject<ModalAutopilotControls | null>;
  onAutopilotComplete?: () => void;
}
```

### `DistanceAutopilotState`

Snapshot of game state that autopilot reads to decide what to do next:

```ts
export interface DistanceAutopilotState {
  screen: "playing" | "won" | "gameover";
  level: 1 | 2 | 3;
  showMonsterAnnounce: boolean;
  roundKey: number;          // increments on every new question
  answerStepKey: string;     // changes when a new answer attempt is expected
  routeKmPoints: number[];   // [startKm, ...checkpointKm values, endKm] for dragging
  targetAnswer: string;      // correct answer as a string (to type on keypad)
  shouldDragRoute: boolean;  // true for L1 and L2 (drag is meaningful); false for L3 hub
  allowWrongAnswer: boolean; // false during Monster Round (autopilot is always correct there)
  levelCompleteVisible: boolean;
  hasNextLevel: boolean;
}
```

### `ModalAutopilotControls`

Exposed by the level-complete report actions component:

```ts
export interface ModalAutopilotControls {
  appendChar: (char: string) => void;
  setEmail: (value: string) => void;
  triggerSend: () => Promise<void> | void;
}
```

---

## Hook API

```ts
export function useDistanceAutopilot({
  callbacksRef,
  autopilotEmail,
  state,
  mode,
}: UseDistanceAutopilotArgs): {
  isActive: boolean;
  activate: () => void;
  deactivate: () => void;
  phantomPos: PhantomPos | null;
}
```

The hook:
- Maintains `isActive` state and `runIdRef` (integer incremented to cancel stale async chains)
- Watches `[isActive, state.*]` — triggers new async sequences on every relevant state change
- Uses `lastRoundKeyRef`, `lastAnswerStepKeyRef`, `lastLevelCompleteKeyRef` to avoid
  re-running the same phase twice

---

## Phase scheduling

### `driveRoute(routeKmPoints: number[])`

```ts
// Teleport to start position, then drag step by step
callbacks.teleportRex(routeKmPoints[0]);
callbacks.setDragging(true);
for segment in route:
  for step = 1 to Math.max(10, ceil(distance / 0.18)):
    km = start + (end - start) * step / steps
    point = getScreenPointForKm(km)
    moveHand(point.x, point.y, false, "center")
    callbacks.moveRex(km)
    await waitMs(rand(DRAG_STEP))
callbacks.setDragging(false);
```

### `typeAnswer(targetAnswer, allowWrongAnswer)`

```ts
callbacks.expandKeypad()
callbacks.clearKeypad()
await waitMs(160)

// Decide correct or wrong
const answerToType = allowWrongAnswer && Math.random() < WRONG_ANSWER_RATE
  ? makeWrongAnswer(targetAnswer)
  : targetAnswer

// Type each character
for char of answerToType:
  await clickElement(char)          // finds data-autopilot-key="<char>"
  await waitMs(rand(BETWEEN_KEYS))

await waitMs(rand(BEFORE_SUBMIT))
clicked = await clickElement("submit")
if (!clicked) callbacks.submitAnswer()
setPhantomPos(null)

if mode === "single-question":
  deactivate()
  callbacks.onAutopilotComplete?.()
```

### `runQuestion(state, answerOnly)`

```ts
if (!answerOnly && state.shouldDragRoute):
  await waitMs(rand(READ_PROMPT))
  await driveRoute(state.routeKmPoints)
await waitMs(rand(BEFORE_ANSWER))
await typeAnswer(state.targetAnswer, state.allowWrongAnswer)
```

### `runLevelComplete(state)`

```ts
await waitMs(rand(BEFORE_EMAIL))
// Click email input, clear it
await waitMs(rand(BEFORE_SEND))
// Type email char by char
await waitMs(rand(BEFORE_SEND))
// Set full email, click send, trigger send
await waitMs(POST_SEND_RESULT_PAUSE_MS)
await waitMs(rand(AFTER_SEND))
if state.hasNextLevel:
  await clickElement("next-level")
else:
  deactivate()
  callbacks.onAutopilotComplete?.()
```

---

## Run ID cancellation

Every new async sequence is checked against `runIdRef.current` before performing
any side effects:

```ts
const runId = ++runIdRef.current;
void (async () => {
  await runQuestion(state, false);
  if (runId !== runIdRef.current) return;  // cancelled — stop here
})();
```

`activate()` and `deactivate()` both increment `runIdRef.current`, cancelling
any in-flight async chain.

---

## `PhantomHand` component

```tsx
export interface PhantomPos {
  x: number;         // screen pixel X
  y: number;         // screen pixel Y
  isClicking: boolean;
  anchor: "center" | "fingertip";  // how the hand SVG aligns to (x, y)
}

interface PhantomHandProps {
  pos: PhantomPos | null;
}
```

When `pos` is null, renders nothing.

When visible:
- Fixed position, z-index: 200, pointer-events: none
- `anchor === "fingertip"`: offset so fingertip is at (x, y)
- `anchor === "center"`: centred at (x, y) — used when tracking the dino's body during dragging
- Cyan hand SVG with drop-shadow: `0 0 12px rgba(103,232,249,0.8)`
- `isClicking`: scale down to 0.85 with `transition: transform 100ms`

**`center` anchor** is used during `driveRoute` so the hand tracks the dino's body
rather than hovering at a fixed fingertip offset.

---

## `AutopilotIcon` component

```tsx
interface AutopilotIconProps {
  onClick: () => void;
  active: boolean;
  title: string;
  ariaLabel: string;
}
```

Renders a robot emoji `🤖` in a circular button.

When `active`:
- `animation: autopilot-blink 2s ease-in-out infinite`
- Cyan glow

When inactive (robot button = "show me how to solve this"):
- No animation, normal `.arcade-button` style

---

## Helper functions (internal)

```ts
function clickElement(key: string): Promise<boolean>
// Finds element by data-autopilot-key, moves hand to it,
// waits 120ms, clicks (hover + click + unhover), returns success.

function moveHand(x, y, isClicking, anchor)
// Sets phantomPos.

async function waitMs(ms: number): Promise<void>
// Promise-based setTimeout.

function getAutopilotElement(key: string): HTMLElement | null
// document.querySelector(`[data-autopilot-key="${key}"]`)
```

---

## Data attributes required in the screen

```tsx
// Keypad digit buttons
data-autopilot-key="0"  // through "9"
data-autopilot-key="."  // decimal point

// Keypad submit button
data-autopilot-key="submit"

// Level complete modal
data-autopilot-key="email-input"
data-autopilot-key="email-send"
data-autopilot-key="next-level"
```
