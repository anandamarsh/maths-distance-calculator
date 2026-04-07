# Game Loop

**File:** `src/screens/ArcadeLevelOneScreen.tsx`

This is the single main game screen. It owns all game state and coordinates every
subsystem — trail, odometer, Monster Round, autopilot, session reporting, social.
All 3 levels run within this same component; only the question generator changes.

---

## Screens

```ts
type Screen = "playing" | "levelComplete" | "gameComplete";
```

The component uses a `screen` state variable:

| Screen | What shows |
|--------|------------|
| `playing` | Trail map + odometer + keypad + HUD |
| `levelComplete` | Session report modal + stats |
| `gameComplete` | Grand completion screen |

---

## Game phases

```ts
type GamePhase = "normal" | "monster";
```

Each level has two phases:

| Phase | Trigger | Odometer | Music |
|-------|---------|----------|-------|
| `normal` | Level start | Visible | Normal music patterns |
| `monster` | After collecting `EGGS_PER_LEVEL` eggs | **Hidden** | Monster music patterns |

The Monster Round announcement (`showMonsterAnnounce`) shows a full-screen overlay
with a randomly chosen name:

```ts
const MONSTER_ROUND_NAMES = [
  "MONSTER ROUND", "TITAN CHALLENGE", "DINO STORM",
  "EXTINCTION EVENT", "JURASSIC GAUNTLET", "THUNDER ROUND",
];
```

---

## Background colours (per level × phase)

```ts
const PHASE_BG: Record<string, { bg: string; glow: string; tint: string }> = {
  "1-normal":  { bg: "#080e1c", glow: "#1e3a5f", tint: "transparent" },
  "1-monster": { bg: "#0f0520", glow: "#5b21b6", tint: "rgba(109,40,217,0.08)" },
  "2-normal":  { bg: "#071510", glow: "#14532d", tint: "transparent" },
  "2-monster": { bg: "#180a00", glow: "#92400e", tint: "rgba(234,88,12,0.1)" },
  "3-normal":  { bg: "#07161a", glow: "#134e4a", tint: "transparent" },
  "3-monster": { bg: "#1a0508", glow: "#7f1d1d", tint: "rgba(220,38,38,0.1)" },
};
```

---

## Level system

3 levels, all run within the same screen component.

| Level | Question type | Source |
|-------|--------------|--------|
| 1 | Total distance | `generateLevelOneQuestions` |
| 2 | Missing leg | `generateLevelTwoQuestions` |
| 3 | Hub comparison | `generateLevelThreeQuestions` |

### Level entry via URL

```ts
function readInitialLevel(): 1 | 2 | 3 {
  const raw = new URLSearchParams(window.location.search).get("level");
  if (raw === "2") return 2;
  if (raw === "3") return 3;
  return 1;
}
```

Adding `?level=2` or `?level=3` to the URL starts the game at that level directly.

### Run system

A **run** is a `{ config, firstQ, dino, dinoColor }` triple created at the start
of each level (or restart). Each run gets a fresh trail config, a fresh dino,
and the first question.

```ts
function createRun(level: number) {
  const config = generateTrailConfig(level);
  const dino = randomDino();
  const dinoColor = DINO_COLORS[Math.floor(Math.random() * DINO_COLORS.length)];
  const firstQ = makeOneQuestion(config, level, dino.nickname);
  return { config, firstQ, dino, dinoColor };
}
```

The config and dino persist for the entire normal phase. Monster Round reuses the
same config but starts a new question from `makeOneQuestion`.

---

## State variables

```ts
// Run
const [run, setRun] = useState(() => createRun(readInitialLevel()));
const [level, setLevel] = useState<1 | 2 | 3>(readInitialLevel());
const [currentQ, setCurrentQ] = useState(run.firstQ);
const [screen, setScreen] = useState<"playing" | ...>("playing");

// Phase
const [gamePhase, setGamePhase] = useState<"normal" | "monster">("normal");
const [eggs, setEggs] = useState(0);                 // normal-phase eggs
const [monsterEggs, setMonsterEggs] = useState(0);   // monster-phase eggs
const [showMonsterAnnounce, setShowMonsterAnnounce] = useState(false);
const [monsterRoundName, setMonsterRoundName] = useState("");

// Dino position
const [posKm, setPosKm] = useState(0);         // current km position on trail
const [minKm, setMinKm] = useState(0);         // leftmost km reached this question
const [maxKm, setMaxKm] = useState(0);         // rightmost km reached this question
const [odomKm, setOdomKm] = useState(0);       // odometer reading (total distance moved)
const [dragging, setDragging] = useState(false);
const [facingLeft, setFacingLeft] = useState(false);

// Keypad
const [calcValue, setCalcValue] = useState("");

// Feedback
const [flash, setFlash] = useState<{ text: string; ok: boolean; icon?: boolean } | null>(null);

// Level 3
const [subStep, setSubStep] = useState(0);           // which step (0/1/2) is active
const [subAnswers, setSubAnswers] = useState<string[]>(["", "", ""]);

// UI
const [topPanel, setTopPanel] = useState<"map" | "question">("map");
const [showShareDrawer, setShowShareDrawer] = useState(false);
const [showCommentsDrawer, setShowCommentsDrawer] = useState(false);
const [soundMuted, setSoundMuted] = useState(() => isMuted());
const [isKeypadMinimized, setIsKeypadMinimized] = useState(false);

// Autopilot
const [autopilotMode, setAutopilotMode] = useState<"continuous" | "single-question">("continuous");
const [demoRetryPending, setDemoRetryPending] = useState(false);

// Discovery flags (first-time UX hints)
const [hasDiscoveredDinoDrag, setHasDiscoveredDinoDrag] = useState(false);
const [hasDiscoveredKeypadDisplay, setHasDiscoveredKeypadDisplay] = useState(false);
const [hasDiscoveredMonsterKeypadDisplay, setHasDiscoveredMonsterKeypadDisplay] = useState(false);

// Level 3 special state
const [extinctionL3ShowSteps, setExtinctionL3ShowSteps] = useState(false);
const [extinctionL3RecoveryMode, setExtinctionL3RecoveryMode] = useState(false);

// Session
const [sessionSummary, setSessionSummary] = useState<SessionSummary | null>(null);
```

Key refs (avoid stale closures):
```ts
const posKmRef = useRef(0);
const minKmRef = useRef(0);
const maxKmRef = useRef(0);
const odometerRef = useRef(0);     // raw odometer accumulator (not React state)
const lastStepRef = useRef(-0.35); // last km at which footstep sound fired
const gamePhaseRef = useRef<"normal" | "monster">("normal");
const keypadValueRef = useRef("");
const handleKeypadChangeRef = useRef(() => {});
const submitAnswerRef = useRef(() => {});
const configRef = useRef(config);
const checkpointsRef = useRef(checkpoints);
const moveRexRef = useRef<(km: number) => void>(() => {});
const autopilotCallbacksRef = useRef<DistanceAutopilotCallbacks | null>(null);
const modalControlsRef = useRef<ModalAutopilotControls | null>(null);
const eggTargetRef = useRef(DEFAULT_EGGS_PER_LEVEL);
const singleQuestionDemoRef = useRef(false);
```

---

## Dino dragging

The player drags the dino by pointing anywhere on the SVG trail. The pointer
position is projected onto the trail to compute a km value.

**On pointer down on the SVG:**
1. `svgRef.current.setPointerCapture(e.pointerId)`
2. Start drag state
3. Move dino to pointer position via `moveRex(projectedKm)`

**On pointer move:**
1. `projectToTrail(config, svgX, svgY, checkpoints)` → km value
2. Clamp to valid range for the current question (prevents dino leaving route)
3. `moveRex(km)` → updates position, odometer, fires footstep sounds

**`moveRex(km: number)`:**
```ts
function moveRex(km: number) {
  const delta = Math.abs(km - posKmRef.current);
  odometerRef.current = Number((odometerRef.current + delta).toFixed(3));
  posKmRef.current = km;
  minKmRef.current = Math.min(minKmRef.current, km);
  maxKmRef.current = Math.max(maxKmRef.current, km);

  // Fire footstep sound every 0.35 km of movement
  if (Math.abs(km - lastStepRef.current) >= 0.35) {
    playStep();
    lastStepRef.current = km;
  }

  setFacingLeft(/* based on direction of motion */);
  setPosKm(km);
  setOdomKm(odometerRef.current);
}
```

---

## Answer submission

### Level 1 and 2

Single-value submission. The child enters the total or missing distance and
presses submit.

```ts
function submitAnswer() {
  const answer = parseFloat(keypadValueRef.current);
  const isCorrect = Math.abs(answer - currentQ.answer) < 0.051; // 0.05 tolerance

  if (isCorrect) {
    playCorrect();
    flashFeedback("✓", true);
    if (!singleQuestionDemoRef.current) {
      logAttempt({ ... });
      advanceEgg();
    }
  } else {
    playWrong();
    flashFeedback(/* correct answer */, false);
    if (!singleQuestionDemoRef.current) {
      logAttempt({ ... });
    }
  }
  // Load next question after flash clears
  setTimeout(loadNextQuestion, SUCCESS_ICON_DURATION_MS);
}
```

**Answer tolerance:** ±0.051 (to handle floating-point noise in 1-decimal answers).

### Level 3: stepped submission

Level 3 questions have 3 sub-steps (see game-logic.md). The child answers each
step in sequence before the final answer unlocks.

```ts
// subStep 0 → answer distA
// subStep 1 → answer distB
// subStep 2 → answer |distA - distB| (the main answer)
```

After each correct sub-step, `subStep` advances. The dino is repositioned to
the appropriate arm of the hub for sub-steps 0 and 1.

**Level 3 Monster Round ("Extinction Event") scaffolding:**
- Initially, only the final comparison question is shown (no 3-step scaffold)
- If the child answers the direct question correctly → egg earned, normal flow
- If the child answers wrong on the first attempt → `extinctionL3ShowSteps = true`
  and the full 3-step scaffold appears with the dino traversing both arms
- Answering via the scaffold earns no egg for that question (`extinctionL3RecoveryMode`)

---

## Egg system

### Normal phase

- 10 eggs required to trigger Monster Round (`DEFAULT_EGGS_PER_LEVEL`)
- 5 eggs in autopilot mode (`AUTOPILOT_EGGS_PER_LEVEL`, set via `eggTargetRef`)
- Each correct answer earns 1 egg; wrong answers earn nothing
- On each egg earned: `playLevelComplete()` plays

### Monster Round transition

When `eggs >= eggTargetRef.current`:
1. `setGamePhase("monster")`
2. `gamePhaseRef.current = "monster"`
3. Pick a random Monster Round name
4. `setShowMonsterAnnounce(true)` — full-screen dramatic overlay
5. `playMonsterStart()` plays
6. `switchToMonsterMusic()` — background music switches to heavy/minor patterns
7. After a delay, `setShowMonsterAnnounce(false)` and load first Monster Round question

### Monster Round eggs

- Monster Round requires the same egg target
- Monster Round eggs use `playGoldenEgg()` (sparkle sound)
- When `monsterEggs >= eggTarget`:
  - `playMonsterVictory()` plays
  - Session summary is built
  - Screen transitions to `levelComplete`

---

## Level completion

On Monster Round clear:
1. Build session summary: `buildSummary({ level, normalEggs: eggs, monsterEggs, levelCompleted: true, monsterRoundCompleted: true })`
2. `setSessionSummary(summary)`
3. `setScreen("levelComplete")` — session report modal appears

On "Next Level" button:
1. Advance `level`
2. New `run = createRun(newLevel)`
3. Reset all egg/phase state
4. Start new session: `startSession()`
5. Start new music: `shuffleMusic()`, `startMusic()`

On "Play Again" button (same level restart):
1. Same as above but same level

On final level (Level 3) completion: `playGameComplete()` fires before the modal.

---

## Odometer display

The odometer is an HTML overlay positioned above the dino token using SVG-to-screen
coordinate conversion (`svgUserToMapLocal`).

**Normal phase:** shows `odomKm` in DSEG7 font with unit suffix.

**Monster Round:** odometer is hidden (tests mental calculation fluency).
A "hint" overlay is shown instead: "??.? km" or similar placeholder.

**Position logic:**
- Non-mobile: odometer floats above the dino, clamped to map edges
- Mobile landscape: odometer anchors to the side (left or right) of the dino
  based on the dino's horizontal position (left half → right anchor, right half → left anchor)
- Uses `ResizeObserver` + `requestAnimationFrame` to stay in sync with layout changes

**Tap to minimize:** tapping the odometer (which is a `<button>`) toggles
the keypad between expanded and minimized state via `keypadToggleRef`.

---

## Keypad

The keypad (`NumericKeypad` inline component) is a decimal-capable numeric input.

**Keys:** 0–9, `.` (decimal), `⌫` (backspace), `±` (sign toggle), submit (✓)

**Data attributes for autopilot:**
```tsx
data-autopilot-key={/[0-9]/.test(btn) || btn === "." ? btn : undefined}
data-autopilot-key="submit"  // on the submit button
```

**Minimization:** keypad can be collapsed to just the display (height animates
via `max-height` transition). Re-expanded on tap. The display click calls `toggleMinimized()`.

**Display hint:** on first encounter, a floating hand SVG pulses over the display
or keypad area to indicate the entry point.

**Physical keyboard:**
```
Digits 0–9  → append to value (layout-independent via e.code)
Backspace   → truncate value
.           → append decimal (once only)
Enter       → submit answer
```

---

## Top panel toggle (mobile)

On mobile portrait the screen is split: top half can show either the map or the
question text. A toggle button switches between them.

```ts
const [topPanel, setTopPanel] = useState<"map" | "question">("map");
```

Landscape layout shows both side by side.

---

## Single-question demo mode

When the robot button is clicked and autopilot is not already active:
1. `singleQuestionDemoRef.current = true`
2. `setAutopilotMode("single-question")`
3. Autopilot activates, plays one question (drag + answer), then stops
4. `demoRetryPending = true` — "Try It Yourself" button appears
5. Player clicks "Try It Yourself" → `setDemoRetryPending(false)`, new question loads

---

## Prevent scroll on touch

```ts
useEffect(() => {
  const prevent = (e: Event) => e.preventDefault();
  document.addEventListener("touchmove", prevent, { passive: false });
  return () => document.removeEventListener("touchmove", prevent);
}, []);
```

---

## JSX structure

```tsx
return (
  <div>
    {/* Top bar: level indicator, mute, autopilot, social buttons */}
    {/* Main area: map SVG + odometer overlay | keypad panel */}
    {/* Monster Round announce overlay */}
    {/* Level complete modal (SessionReportModal / LevelCompleteReportActions) */}
    {/* Demo retry overlay */}
    <PhantomHand pos={phantomPos} />
  </div>
);
```

`PhantomHand` renders as a fixed overlay above all other layers (z-index 200).

---

## Autopilot wiring (in the screen)

```ts
autopilotCallbacksRef.current = {
  clearKeypad: () => { setCalcValue(""); keypadValueRef.current = ""; },
  expandKeypad: () => keypadToggleRef.current?.(),
  setDragging,
  teleportRex: (km) => { posKmRef.current = km; odometerRef.current = 0; ... },
  moveRex: (km) => moveRexRef.current(km),
  getScreenPointForKm: (km) => svgUserToViewport(svgRef.current!, px, py),
  submitAnswer: () => submitAnswerRef.current(),
  goNextLevel: handleNextLevel,
  emailModalControls: modalControlsRef,
  onAutopilotComplete: deactivateAutopilot,
};
```

See `specs/autopilot.md` for the full autopilot system.
