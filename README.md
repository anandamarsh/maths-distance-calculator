# Trail Distance Calculator

> An arcade-style maths game where kids drag a dinosaur along a trail map and calculate distances.

## What It Is

Trail Distance Calculator is a drag-based, procedurally generated maths game built as a Progressive Web App. A dinosaur character lives on a randomly generated trail map connecting named towns. The child drags the dinosaur along the roads — an odometer counts the distance travelled — and answers questions about those distances.

Every session generates a completely fresh map: new town names, new distances, new colours, new dinosaur. No two games are the same.

## What It Teaches

| Level | Skill |
|---|---|
| **Level 1** | Adding decimal distances across multiple road segments to find a total journey distance |
| **Level 2** | Subtracting decimals — one road segment is hidden as `?`, child finds the missing leg given the total |
| **Level 3** | Comparing two distances from a shared hub — "how much farther is A than B?" — with three scaffolded input steps |

All arithmetic is grounded in a real-world map-distance context. Decimal numbers (km or miles) are used throughout.

## How to Play

1. Read the question — it tells you which towns the dinosaur needs to travel between.
2. Drag the dinosaur along the trail. The odometer counts how far it has walked.
3. Type your answer and press the tick button.
4. **Correct** → earn a white egg. **Wrong** → lose an egg.
5. Collect **10 eggs** to unlock the **Monster Round** — same questions, but the odometer is hidden. You must calculate in your head!
6. Earn **10 golden eggs** in the Monster Round to complete the level.
7. Clear all 3 levels for the grand finale. 🦕

## Features

- 🦕 **6 dinosaur characters** — Velociraptor (Blaze), Ninja Velociraptor (Shadow), Diplodocus (Stretch), Parasaurolophus (Crest), Dimetrodon (Spike), Pterodactylus (Talon) — one chosen randomly each game
- 🎵 **9 original chiptune music tracks** — 6 normal, 3 dramatic Monster Round themes — all synthesised in real-time via Web Audio API (no audio files)
- 🗺️ **Procedural maps** — fresh town names, distances, colours, and trail geometry every question
- 📏 **Accurate odometer** — drag anywhere along the road; the distance counter updates as you move, including backtracking
- 🥚 **Egg progression** → ⭐ **Monster Round** — a two-phase reward system per level
- 📱 **Mobile + desktop** — tap-to-drag works on touchscreens; layout adapts to all screen sizes
- 🔇 **Sound toggle** — mute button for classroom use

---

# How It Works — Internal Reference

A complete technical reference for recreating this game from scratch. Every design decision, data structure, algorithm, visual detail, and sound is documented below.

---

---

## Table of Contents

1. [Overview & Concept](#1-overview--concept)
2. [Tech Stack](#2-tech-stack)
3. [Project Structure](#3-project-structure)
4. [Game Progression & State Machine](#4-game-progression--state-machine)
5. [Map Generation (`levelOne.ts`)](#5-map-generation-levelonets)
6. [Question Generation](#6-question-generation)
7. [Dinosaur Characters (`dinos.ts`)](#7-dinosaur-characters-dinoots)
8. [Drag Mechanics & Odometer](#8-drag-mechanics--odometer)
9. [Track Coloring](#9-track-coloring)
10. [Egg Collection System](#10-egg-collection-system)
11. [Monster Round](#11-monster-round)
12. [Sound System (`sound/index.ts`)](#12-sound-system-soundindexts)
13. [Visual Design & CSS](#13-visual-design--css)
14. [UI Layout](#14-ui-layout)
15. [Level 3 — Distance Comparison Widget](#15-level-3--distance-comparison-widget)
16. [Feedback System — Flash Icons](#16-feedback-system--flash-icons)
17. [Background Themes](#17-background-themes)
18. [Dev-Only Features](#18-dev-only-features)
19. [Build & Deployment](#19-build--deployment)
20. [Key Design Decisions](#20-key-design-decisions)

---

## 1. Overview & Concept

This is a single-screen, drag-based maths arcade game. A dinosaur character lives on a procedurally generated trail map connecting named towns. The child drags the dinosaur along roads to explore distances, and answers questions about those distances.

**Core loop:**
1. A fresh random map (towns, distances, colours) is generated.
2. A question is shown about distances on that map.
3. The child drags the dino along the trail — an odometer counts distance travelled.
4. The child types the answer and submits.
5. Correct → earn a white egg. Wrong → lose an egg. Collect 10 eggs → **Monster Round**.
6. Monster Round: same question types, but odometer is hidden. Child must calculate mentally. Earn 5 **golden** eggs → level complete.
7. Three levels, each with its own question type. Completing Level 3's Monster Round → grand finale.

**Pedagogical intent:**
- Level 1: adding decimal distances along a multi-stop route.
- Level 2: subtraction — a segment's distance is hidden; child finds the missing leg given the total.
- Level 3: comparison — "how much farther is A than B from a shared hub?"

---

## 2. Tech Stack

| Tool | Purpose |
|---|---|
| React 18 | UI component model, hooks for state |
| TypeScript | Type safety throughout |
| Vite | Dev server (port 4001, `strictPort: true`) + production build |
| Tailwind CSS v4 (via `@tailwindcss/vite`) | Utility-first styling |
| Web Audio API | All music and sound effects — no audio files |
| SVG | Map, dino sprite, eggs, feedback icons, comparison widget |
| GitHub Actions | Auto-deploy to GitHub Pages on push to `main` |

**Vite config:**
- Dev base: `/`
- Prod base: `/maths-distance-calculator/` (GitHub Pages sub-path)
- Dev server always on port 4001; kills any existing process first via `lsof -ti :4001 | xargs kill -9` in the `dev` npm script.

---

## 3. Project Structure

```
src/
  main.tsx                     — React root
  index.css                    — Global styles, custom fonts, CSS animations, component classes
  game/
    levelOne.ts                — All map and question generation logic
    dinos.ts                   — Dinosaur sprite library (SVG paths + metadata)
  screens/
    ArcadeLevelOneScreen.tsx   — The single game screen (entire game UI and logic)
  sound/
    index.ts                   — All sound effects and background music via Web Audio API
public/
  manifest.json                — PWA/shell metadata
  favicon.svg                  — App icon
  dseg/fonts/DSEG7-Classic/    — Digital clock font (woff/woff2)
index.html                     — HTML entry point
vite.config.ts                 — Vite configuration
.github/workflows/deploy.yml   — GitHub Actions CI/CD
```

There is **one screen** — `ArcadeLevelOneScreen.tsx`. All three levels, the Monster Round, and the game-over state are managed inside this single component.

---

## 4. Game Progression & State Machine

### Screen states

```typescript
type Screen = "playing" | "won" | "gameover";
```

- `"playing"` — normal gameplay
- `"won"` — level complete overlay (Levels 1 & 2 only, after Monster Round)
- `"gameover"` — grand finale overlay (Level 3 Monster Round complete)

### Phase states

```typescript
type GamePhase = "normal" | "monster";
```

Each level has two phases: **normal** (collect 10 white eggs) → **monster** (collect 10 golden eggs).

### Level progression

```typescript
const [level, setLevel] = useState<1 | 2 | 3>(1);
const [unlockedLevel, setUnlockedLevel] = useState<1 | 2 | 3>(1);
```

- In **development** (`import.meta.env.DEV`): all levels are freely accessible.
- In **production**: levels unlock sequentially. A level button is locked if `lv > unlockedLevel && lv > level`.

### Full game flow

```
Start Level 1 (normal phase)
  └─ Collect eggs 1–4: new question each time
  └─ Egg 5 collected → startMonsterRound()
       ├─ Play dramatic sting sound
       ├─ Switch to monster music
       ├─ Show announce overlay for 2.8s
       ├─ Set gamePhase = "monster"
       └─ Generate fresh run

  Monster Round (10 white eggs → turn golden)
  └─ Each correct → earn golden egg, play sparkly sound
  └─ Each wrong → lose golden egg
  └─ 10 golden eggs collected:
       ├─ Level 1/2: playMonsterVictory() → setScreen("won") → "Next Level" button
       └─ Level 3: playGameComplete() → setScreen("gameover") → "Play Again" button

  Next Level: beginNewRun(level + 1)
    └─ Resets phase to "normal", eggs to 0, switches back to normal music
```

---

## 5. Map Generation (`levelOne.ts`)

### Stop (town) count

| Level | Stop count |
|---|---|
| 1 | `randomInt(3, 5)` |
| 2 | `randomInt(5, 6)` — needs more stops for multi-segment questions |
| 3 | Same as Level 2 (uses the same `generateTrailConfig(level)` call) |

### Town names

Drawn from a pool of 30 fictional but plausible place names:
```
"Greenville", "Silvergrove", "Winchester", "Sparrowtown", "Campbell",
"Hillsboro", "Newberg", "Fairfax", "Centerville", "Milford",
"Summerfield", "Dayton", "Lakewood", "Brookfield", "Cedarburg",
"Allenville", "Redbank", "Pinecrest", "Marshpoint", "Fox Hollow",
"Starfield", "Oakridge", "Willow Bay", "Stonepass", "Maple Glen",
"Ridgeview", "Ironwood", "Dustfall", "Crestwick", "Ashport"
```
A random subset is shuffled and sliced to the required stop count.

### Stop positions (SVG coordinates)

Stops are laid out left-to-right. The x-axis spans from 110 to 1170 (SVG units), evenly distributed by the stop's index fraction `t = i / (stopCount - 1)`. The y-axis has the first and last stop fixed at `y = 340`, while intermediate stops have a random offset in the range `[-80, +80]` to create a natural winding trail.

```typescript
x = Math.round(110 + t * 1060)
y = Math.round(340 + yOffsets[i])   // yOffsets[0] = yOffsets[last] = 0
```

### Edge distances

Each edge (road segment) gets a random decimal distance:
- km: `randomDecimal(1.5, 9.9)`
- mi: `randomDecimal(1.5, 8.9)`

`randomDecimal` rounds to one decimal place.

### Unit

50% chance of km, 45% chance of mi, decided per run.

### Colour palettes

Four palette objects are defined, each with:
- `bg` — radial gradient centre colour (overridden by `PHASE_BG` per level/phase)
- `bgGlow` — top glow colour
- `trail` — unlit/dim road colour
- `visited` — forward travel colour
- `repeated` — backward travel colour (should contrast strongly with `visited`)
- `node` — stop circle fill
- `text` — stop label colour
- `accent` — active stop ring colour
- `panel` — (unused in current UI, kept for future)

One palette is randomly selected per run.

### ViewBox (tight fit)

The SVG viewBox is computed dynamically from the actual stop coordinates:
```typescript
const padTop = 115;    // room for dino sprite above nodes
const padBottom = 60;  // room for stop labels
const padSide = 80;    // room for label text either side
vbX = min(xs) - padSide
vbY = min(ys) - padTop
vbW = (max(xs) - min(xs)) + padSide * 2
vbH = (max(ys) - min(ys)) + padTop + padBottom
```
This ensures the trail always fills the full map area regardless of screen ratio or stop count.

---

## 6. Question Generation

All questions are generated fresh per-answer (not pre-generated in batches). Each correct or wrong answer triggers a new question. The config (map) is also regenerated per-egg in normal mode and per-correct in monster mode.

### Level 1 — Total distance

**Prompt:** `"[DinoName] wants to go from [A] to [B]. How far should [DinoName] travel?"`  
(Multi-stop variant: `"[DinoName] goes from [A] → [B] → [C]. How far should [DinoName] travel in total?"`)

**Route:** 1–3 hops, randomly walked along the trail (can go forward or backward).

**Answer:** Sum of edge distances along the route, rounded to 1 decimal place.

**`buildQuestionRoute(stopCount, hopCount)`:** Starts at a random stop, each step picks a random adjacent stop (left or right), never exceeding array bounds.

### Level 2 — Missing segment

**Prompt:** `"The total distance from [A] to [B] is [X] km. What is the missing distance from [C] to [D]?"`

**Route:** 2–5 consecutive stops (sequential, forward only).

**Hidden edge:** One edge in the route is randomly chosen to have its label replaced with `?` on the map.

**Answer:** The hidden edge's distance value.

**Total shown:** The full route distance is given in the prompt and also displayed below the odometer as `Σ X.X km`.

**`?` label on map:** Rendered as a large `fontSize="54"` text above the midpoint of the hidden edge, in the palette's accent colour, with a thick black outline (`paintOrder="stroke"`). No enclosing circle.

### Level 3 — How much farther (3-step scaffolded)

**Prompt:** `"From [Hub], how much farther is it to [Far] than to [Near]?"`

**Structure:** Three sequential input steps:
1. `"How far is it from [Hub] to [Left]?"` → answer: `distA`
2. `"How far is it from [Hub] to [Right]?"` → answer: `distB`
3. `"From [Hub], how much farther is it to [Far] than to [Near]?"` → answer: `|distA - distB|`

**Hub:** A stop that has an edge on both sides (stop indices 1 to n-2).

**Answer:** `Math.abs(distA - distB)`, rounded to 1 decimal.

**Error tolerance:** ±0.11 km/mi on all answers.

**Step rules:**
- Steps 1 & 2 wrong: flash error, retry, **no egg loss**.
- Step 3 wrong: flash error, new question generated, **egg lost**.
- Once a step is correct, it's locked (displays the confirmed value in green). The next step activates.
- All three input rows are always visible; future steps are `opacity-30` and their inputs/buttons are `disabled`.

---

## 7. Dinosaur Characters (`dinos.ts`)

Six dinosaur sprites from [game-icons.net](https://game-icons.net) by Delapouite (CC BY 3.0):

| ID | Display Name | In-game Nickname (used in prompts) |
|---|---|---|
| `velociraptor` | Velociraptor | Blaze |
| `ninja-velociraptor` | Ninja Velociraptor | Shadow |
| `diplodocus` | Diplodocus | Stretch |
| `parasaurolophus` | Parasaurolophus | Crest |
| `dimetrodon` | Dimetrodon | Spike |
| `pterodactylus` | Pterodactylus | Talon |

Each `DinoSprite` has: `id`, `name`, `nickname`, `author`, `license`, `url`, `path` (SVG path `d` attribute for a `0 0 512 512` viewBox).

One dino is randomly selected per `createRun()` call (i.e. every time a new map is generated). The `nickname` is injected into Level 1 question prompts.

**Rendering:** The dino is an SVG `<g>` translated to the current position on the trail. It contains:
1. An ellipse ground shadow (`fill="rgba(0,0,0,0.32)"`).
2. A nested `<svg x={-50} y={-100} width={100} height={100}>` containing the path, coloured with a random `dinoColor` from `DINO_COLORS`.
3. A `dino-walk` CSS animation class applied when moving (vertical bob + slight rotation, 0.18s linear infinite).
4. A transparent `<circle r={80}>` hit area.

**Dino colours** (6 options, random per run):
`#22c55e, #34d399, #4ade80, #86efac, #a3e635, #facc15`

**Halo while dragging:** A glowing green ring rendered as the **last element** in the SVG (so it always paints above everything else). Two concentric circles: a thick semi-transparent ring and a thin ring with a CSS `drop-shadow` filter chain for glow. `pointerEvents: "none"` prevents it from interfering with drag detection.

---

## 8. Drag Mechanics & Odometer

### Pointer event strategy

React's synthetic pointer events (`onPointerMove`, `onPointerUp`) are **not** used for the actual drag tracking. Instead:

1. `onPointerDown` on the dino's hit area calls `startDrag(e)`.
2. `startDrag` calls `svgRef.current.setPointerCapture(e.pointerId)` so the SVG keeps receiving events even if the finger drifts away.
3. `window.addEventListener("pointermove", ...)` and `window.addEventListener("pointerup", ...)` are registered **once** on mount via `useEffect([], [])`.
4. The callbacks read from **refs** (`configRef`, `checkpointsRef`, `moveRexRef`) rather than state/closures so they never go stale.

This pattern ensures reliable drag on mobile where synthetic events can be interrupted by scroll, tap, or browser UI gestures.

**Movement only starts when the pointer is on the dino.** The `draggingRef` flag is only set to `true` in `startDrag` (on the dino), and only `false` in `onPointerUp`. The `onPointerMove` window listener checks `draggingRef.current` before doing anything.

### Position on trail — `projectToTrail`

Given an SVG coordinate `(svgX, svgY)`, the function finds the nearest point on the trail and returns the corresponding distance in km/mi from the start:

```
for each edge:
  project (svgX, svgY) onto the line segment
  measure Euclidean distance from projected point to cursor
  track the edge + t-value (0–1) that gives minimum distance
return checkpoints[bestEdge] + edges[bestEdge].distance * t
```

### Snap zones

To prevent odometer jitter when the dino sits exactly on a node, each node has a snap zone:
```
snapKm = min(edgeBefore.distance, edgeAfter.distance) * 0.15
if |clamped - checkpoint[i]| <= snapKm → snap to checkpoint[i]
```
Zones are designed to never overlap (15% + 15% = 30% < 100% of shortest edge).

### Odometer accumulation

```typescript
const delta = Math.abs(clamped - prev);
if (delta < 0.001) return;  // dead zone — ignore micro-jitter

odometerRef.current += delta;
if (gamePhase === "normal") setOdomKm(odometerRef.current);  // hide in Monster Round
```

In **Monster Round**, `odometerRef` still accumulates (for footstep sound cadence), but `setOdomKm` is never called — the display stays at `--.-`.

### Footstep sounds

Every 0.35 km of accumulated travel triggers `playStep()`. Tracked via `lastStepRef`.

### `posAtKm` — reverse lookup

Given a distance value, returns the SVG `(x, y)` position for rendering the dino:
```
for each edge i:
  if km is within [checkpoints[i], checkpoints[i+1]]:
    t = (km - checkpoints[i]) / edge.distance
    return lerp(stops[i], stops[i+1], t)
```

---

## 9. Track Coloring

The trail has three visual states:

| State | Description | Color |
|---|---|---|
| Unlit | Not yet visited | Dark road: `rgba(0,0,0,0.5)` outer, `#1a2a3a` inner |
| Visited | Forward travel | `palette.visited` (e.g. yellow `#facc15`) |
| Repeated | Backward over visited path | `palette.repeated` (e.g. magenta `#e879f9`) |

**Bidirectional range tracking:**
- `minKmRef` — the minimum km ever reached (decreases as dino moves left)
- `maxKmRef` — the maximum km ever reached (increases as dino moves right)

Both start at the dino's starting position for the current question (not necessarily 0).

For each edge, the **visited range** is `[minKm, maxKm]` clipped to that edge's `[edgeStart, edgeEnd]` range, converted to t-values (0–1):
```
visitedFromT = clamp((minKm - edgeStart) / edgeDistance, 0, 1)
visitedToT   = clamp((maxKm - edgeStart) / edgeDistance, 0, 1)
```

The **repeat overlay** covers the region from the dino's current position back to `maxKm`:
```
showRepeat = (maxKm > posKm + 0.05) && (visitedToT > repFromT + 0.001)
```

**SVG paint order within each edge's `<g>`:**
1. Dark unlit road (wide black outer + narrower dark inner)
2. Faint route highlight (shows which edges are relevant to the question)
3. Visited (colored forward travel)
4. Repeat overlay (backward track — wider base + white dashed centre stripe)
5. White centre dashes — **always painted last** so they're always visible

**Resetting:** The reload button calls `resetPosition(startKm)`, which zeroes the odometer and resets `minKmRef` and `maxKmRef` to `startKm`. The dino teleports to the question's start stop; track becomes fully unlit again.

---

## 10. Egg Collection System

**Normal phase:**
- 10 egg slots displayed in the top bar (two rows of five)
- Empty egg: transparent fill, faint white outline (`rgba(255,255,255,0.22)`)
- Collected egg: white fill, white stroke, drop-shadow glow, inner gleam ellipse

**Monster phase:**
- All 10 eggs start as **white-filled** (pearly, clearly visible as "to be turned golden")
- Correct answer: egg turns **golden** (`#facc15` fill, `#fbbf24` stroke, golden drop-shadow)
- Wrong answer: golden egg reverts to white
- The gleam ellipse has `opacity=0.35` on golden eggs and `opacity=0.18` on white pending eggs

**Egg SVG (for each egg, applied in both contexts):**
```svg
<path d="M256 16C166 16 76 196 76 316c0 90 60 180 180 180s180-90 180-180c0-120-90-300-180-300z"
  fill={...} stroke={...} strokeWidth="18" />
<ellipse cx="190" cy="150" rx="35" ry="60"
  fill={...} opacity={...} transform="rotate(-20 190 150)" />
```

The egg shape is a custom rounded-bottom oval (not a stock circle). The inner ellipse creates a gleam highlight tilted at -20°.

---

## 11. Monster Round

### Trigger

When `eggsCollected` reaches 10 in normal phase, `earnEgg()` calls `startMonsterRound()` instead of showing the won screen.

### `startMonsterRound()`

1. Randomly picks one of 6 round names: `MONSTER ROUND`, `TITAN CHALLENGE`, `DINO STORM`, `EXTINCTION EVENT`, `JURASSIC GAUNTLET`, `THUNDER ROUND`.
2. Sets `gamePhase = "monster"`, `monsterEggs = 0`.
3. Plays `playMonsterStart()` — a dramatic descending sting.
4. Calls `switchToMonsterMusic()` — picks from 3 heavy minor-key music patterns.
5. Shows `showMonsterAnnounce = true` — a full-screen purple overlay for 2.8 seconds.
6. Generates a fresh `createRun(level)` — new map, new dino.
7. Resets position.

### Announce overlay

Full-screen `z-[70]` overlay with:
- Purple radial gradient background
- Animated dino emoji
- Round name in large yellow text with glowing text-shadow
- "No odometer — solve it in your head!"
- "Collect 10 Golden Eggs ✨"
- Auto-dismisses after 2.8 seconds

### Odometer in Monster Round

- `odometerRef` still accumulates internally (for footstep sounds)
- `setOdomKm()` is never called → display stays frozen
- Both mobile and desktop odometers show `"--.-"` in `text-slate-500` (greyed out)
- Click handlers disabled
- `opacity-40 cursor-not-allowed` styling

### Background theme change

Each level × phase combination has a distinct background:

| | Normal | Monster |
|---|---|---|
| Level 1 | Dark navy | Deep purple |
| Level 2 | Dark forest green | Fiery amber |
| Level 3 | Dark teal | Blood crimson |

See `PHASE_BG` constant for exact hex values and tint overlays.

### Monster Round badge

A prominent gold glowing pill in the top bar:
- Amber gradient background
- Yellow text (`#fef08a`) with text-shadow glow
- Gold border (`#fbbf24`)
- Outer box-shadow glow
- CSS `pulse` animation (Tailwind)

### Level button colour in Monster Round

The active level button turns amber/gold:
- Background: `#92400e`
- Border: `#fbbf24`
- Text: `#fde047`

Completed levels (below current) always show gold: background `#78350f`, border `#fbbf24`, text `#fde047`, box-shadow gold glow.

### Earning golden eggs — `earnMonsterEgg()`

- Plays `playGoldenEgg()` (sparkly ascending arpeggio)
- Correct flash icon shown
- New `createRun(level)` generated

At 10 golden eggs:
- Level 1 or 2: `playMonsterVictory()` → `setScreen("won")` (level complete overlay)
- Level 3: `playGameComplete()` → `setScreen("gameover")` (grand finale)

### Level complete overlay (`screen === "won"`)

Shown for Levels 1 & 2 after Monster Round. Contains:
- "Level X Complete!" heading (yellow)
- "🦕 Monster Round Crushed! 🦕"
- Row of 5 glowing golden egg SVGs
- "Next Level" button (no arrow)

---

## 12. Sound System (`sound/index.ts`)

All audio is synthesised in real-time using the **Web Audio API**. No audio files are used. This keeps the bundle tiny and allows infinite variation.

### Core oscillator helper — `tone(freq, start, dur, vol, type)`

Creates an oscillator + gain node, connects to `AudioContext.destination`, ramps gain to near-zero at `start + dur` (exponential decay). Oscillator types: `"square"`, `"sawtooth"`, `"triangle"`, `"sine"`.

### Noise burst helper — `noiseBurst(startTime, filterFreq, vol, dur)`

Creates a white noise buffer, passes it through a bandpass `BiquadFilter` at `filterFreq`, and applies an exponential gain ramp. Used for claps, impacts, and footstep sounds.

### Individual sound effects

| Function | Description |
|---|---|
| `playStep()` | Footstep: alternating left/right using `footToggle`. Noise crack + bass thud + high tick. |
| `playCorrect()` | Bass thump + 4-note ascending square arpeggio + high triangle sparkle. |
| `playWrong()` | Bass thump + 4-note descending sawtooth "wah". |
| `playButton()` | Two quick square tones (button press feedback). |
| `playLevelComplete()` | 6-note ascending melody. |
| `playMonsterStart()` | Dramatic descending sting: two sawtooth bass hits + 3 descending square notes + heavy sawtooth sustain + noise burst. |
| `playGoldenEgg()` | 5-note ascending triangle arpeggio into ultrasonic, closing with a noise sparkle. |
| `playMonsterVictory()` | Clap sequence (4 bursts) + ascending 8-note fanfare + second clap burst + 3-note sustaining chord. |
| `playGameComplete()` | Extended 6-clap sequence + 11-note two-octave fanfare + big clap burst + 4-note sustaining chord. |

### Background music

**6 normal music patterns** and **3 monster music patterns** (all defined as `MusicPattern` objects with `melody[]`, `bass[]`, `bpm`, volume, and oscillator type overrides).

```typescript
interface MusicPattern {
  melody: number[];      // frequency in Hz, 0 = rest
  bass: number[];
  bpm: number;
  melodyVol?: number;
  bassVol?: number;
  melodyType?: OscillatorType;
  bassType?: OscillatorType;
}
```

The `tick()` function fires on a `setTimeout` cadence (beat duration = 60/bpm seconds), playing one step of melody and bass per tick, then looping.

**Normal music themes:** bouncy adventure, upbeat march, gentle explorer, energetic sprint, mystery trail, dino stomp.

**Monster music themes:** boss battle (heavy minor, sawtooth), ominous creep (square/sawtooth), Jurassic rampage (sawtooth/triangle).

`shuffleMusic()` always picks from the **normal** patterns (even if currently playing monster music, since monster patterns aren't in the `MUSIC_PATTERNS` array). `switchToMonsterMusic()` explicitly picks from `MONSTER_MUSIC_PATTERNS`.

### Mute

`toggleMute()` flips a module-level `muted` boolean. All synthesis functions check this at the top and return early if muted. The Web Audio context is not paused — muting just suppresses future note creation.

---

## 13. Visual Design & CSS

### Fonts

- **UI font:** `"Courier New", "Lucida Console", monospace` — applied globally via `.font-arcade` class. Creates the arcade terminal aesthetic.
- **Odometer font:** DSEG7Classic (self-hosted woff/woff2). A 7-segment digital display font. Applied via `.digital-meter` class with `letter-spacing: 0.12em` and a cyan text-shadow glow.

### CSS Component Classes

**.arcade-panel** — Question box, comparison widget container:
```css
border: 4px solid rgba(255,255,255,0.7);
border-radius: 14px;
background: rgba(15, 23, 42, 0.97);
box-shadow: 0 0 0 4px rgba(15,23,42,0.8), 0 18px 40px rgba(0,0,0,0.3);
```

**.arcade-meter** — Odometer container:
```css
border: 4px solid rgba(125,211,252,0.9);
border-radius: 16px;
background: rgba(2,6,23,0.92);
box-shadow: inset 0 0 24px rgba(56,189,248,0.22), 0 0 24px rgba(14,165,233,0.2);
```

**.arcade-button** — Submit, Next Level, Play Again buttons:
```css
border: 3px solid #fef08a;
border-radius: 9999px;  /* pill shape */
background: linear-gradient(180deg, #f97316, #ea580c);  /* orange gradient */
font-weight: 900; text-transform: uppercase; letter-spacing: 0.1em;
/* active: translateY(2px) for press-down feel */
```

**.arcade-grid** — Full-screen dot/grid texture overlay:
```css
background-image:
  linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px),
  linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px);
background-size: 22px 22px;
```

### CSS Animations

| Name | Used for |
|---|---|
| `walk-bob` | Dino walking — vertical bob + slight rotation, 0.18s linear infinite |
| `icon-pop` | Green tick correct feedback — scale from 0 with overshoot, centred on screen |
| `icon-pop-wrong` | Red cross wrong feedback — same but with rotation wobble |
| `bounce-in` | Text flash validation messages |
| `floatUp` | Upward fade-out (minor UI transitions) |

### Stop markers

Each stop is a `<StopMarker>` SVG component:
- Inactive: `r=24`, dark fill, muted border
- Active (part of current question route): `r=30`, accent-coloured fill/border, outer glow ring (`opacity=0.16`)
- Label: `fontSize=21`, bold white, black paint-order stroke for legibility
- Ground shadow: small dark ellipse below the node

Only the stops relevant to the **current question's route** are active/highlighted.

### Road rendering (per edge, in paint order)

1. Black outer shadow line (`strokeWidth=34`, `rgba(0,0,0,0.5)`)
2. Dark road fill (`strokeWidth=26`, `#1a2a3a`)
3. Faint route highlight if `isRouteEdge` (`strokeWidth=14`, `palette.trail`, `opacity=0.18`)
4. Visited fill if applicable (`strokeWidth=14`, `palette.visited`)
5. Repeat overlay if applicable (`strokeWidth=18`, `palette.repeated` + white dashed centre)
6. White centre dashes — **always last** (`strokeWidth=3`, `rgba(255,255,255,0.22)`, `strokeDasharray="18 14"`)
7. Distance label above midpoint (`fontSize=27`, bold, black outline via `paintOrder="stroke"`)

---

## 14. UI Layout

The screen is a single `position: relative; height: 100svh; width: 100vw; overflow: hidden` container.

### Z-index layers

| Layer | z-index | Contents |
|---|---|---|
| Background | 0 | Radial gradient + grid overlay |
| Monster tint | 1 | Phase-specific colour overlay |
| Dino attribution | 10 | Bottom-right text |
| Map | 20 or 40 | SVG trail (toggles with question panel) |
| Top bar | 20 | Buttons + level selector + odometer |
| Bottom bar | 50 | Question panel + input (always on top) |
| Flash feedback | 50 | Correct/wrong icons |
| Won screen | 30 | Level complete overlay |
| Monster announce | 70 | Round entry announcement |
| Game over | 80 | Grand finale screen |

### Tap-to-bring-forward

On mobile the map and question panel can overlap. Clicking the map sets `topPanel = "map"` (map z-40, question z-20 via bottom-bar click → question comes forward). The bottom bar is permanently `z-50` regardless, ensuring inputs are always clickable.

### Top bar

```
[Reset btn] [Mute btn]    [L1] [L2] [L3]          [Odometer]
                        [Monster Round Badge]
                          [Egg row]
                        [Mobile odometer]
```

- On mobile: icon buttons stack in a column on the left, offset below the shell's home button (`mt-[76px]`).
- On desktop: icon buttons are in a row, offset right of the home button (`ml-[64px]`).
- The odometer is hidden on mobile (a compact version appears under the eggs); shown on desktop at the right edge.

### Bottom bar

Always `z-50`. Contains:
- For Level 1/2: `arcade-panel` with the question text + answer input + round submit button
- For Level 3: `arcade-panel` with three rows (prompt + confirm button each), plus the distance comparison widget above it

### Question prompt

The `ColoredPrompt` component parses text with a regex `/(\d+\.?\d*)/g` and wraps numbers in `<span className="text-yellow-300 font-black">`. Everything else is bold white. This helps children visually parse the numbers from the words.

---

## 15. Level 3 — Distance Comparison Widget

Appears after the first step is answered correctly (`subStep >= 1`). Sits above the question form inside the bottom bar.

### Layout (SVG, viewBox `0 0 380 100`)

**Step 1 answered (showBoth = false), svgH = 50:**
- Green segment line at `y=22` from `lineX0` to `x1end`
- Green dots at endpoints
- Hub label (`#94a3b8`, centred on `lineX0`) at `y=42`
- Dest1 label (green, centred on `x1end`) at `y=14`
- Distance value (green, bold) centred on segment midpoint `(lineX0 + x1end) / 2` at `y=42`

**Step 2 also answered (showBoth = true), svgH = 100:**
- Same as above plus:
- Pink segment line at `y=68` from `lineX0` to `x2end`
- Pink dots, Dest2 label at `y=60`, pink distance value at `y=88`
- **Difference bracket:** dashed yellow line from `xShort` to `xLong` anchored at the y-level of the **shorter** segment:
  ```typescript
  const bY = d1 <= d2 ? 22 : 68;
  ```
  Tick marks at both ends (`bY ± 8`). `?` label at `bY + 16` (below bracket, always in clear space).

**Proportional scaling:**
```typescript
const x1end = lineX0 + (d1 / maxD) * usableW;
const x2end = lineX0 + (d2 / maxD) * usableW;
```
Where `maxD = max(d1, d2)`. The longer segment always fills the full width; the shorter one is proportionally shorter.

**Station names** are derived from `currentQ.hubStop` (the hub stop index), not by parsing the prompt text:
```typescript
const hub   = config.stops[hubIdx].label;
const dest1 = config.stops[hubIdx - 1].label;
const dest2 = config.stops[hubIdx + 1].label;
```

**Colours:**
- Segment 1: `#4ade80` (green)
- Segment 2: `#f472b6` (pink)
- Difference/unknown: `#fde047` (yellow)

---

## 16. Feedback System — Flash Icons

On correct or wrong answer, a large SVG icon pops up centred on screen (`z-50`, auto-dismissed after 1.1s).

**Correct (green tick):**
```svg
<circle r=54 fill="#052e16" opacity=0.82 />
<circle r=54 stroke="#4ade80" strokeWidth=5 />
<path d="M30 62 L50 82 L90 38" stroke="#4ade80" strokeWidth=13 />
```
Animation: `icon-pop` (scale-in with overshoot). Drop-shadow: two-layer green glow filter.

**Wrong (red cross):**
```svg
<circle r=54 fill="#2d0a0a" opacity=0.82 />
<circle r=54 stroke="#f87171" strokeWidth=5 />
<path d="M38 38 L82 82 M82 38 L38 82" stroke="#f87171" strokeWidth=13 />
```
Animation: `icon-pop-wrong` (scale-in with rotation wobble).

Both icons are `position: absolute, top: 38%, left: 50%` — the animation handles the `translate(-50%, -50%)` centring as part of the keyframe.

Text flash (validation only — "Enter a number!", "Try again!") uses a different non-icon style: coloured `arcade-panel`-style box with `animate-bounce-in`.

---

## 17. Background Themes

The full-screen background is a `radial-gradient(ellipse at top, glow 0%, bg 72%)`.

```typescript
const PHASE_BG = {
  "1-normal":  { bg: "#080e1c", glow: "#1e3a5f", tint: "transparent" },
  "1-monster": { bg: "#0f0520", glow: "#5b21b6", tint: "rgba(109,40,217,0.08)" },
  "2-normal":  { bg: "#071510", glow: "#14532d", tint: "transparent" },
  "2-monster": { bg: "#180a00", glow: "#92400e", tint: "rgba(234,88,12,0.1)"  },
  "3-normal":  { bg: "#07161a", glow: "#134e4a", tint: "transparent" },
  "3-monster": { bg: "#1a0508", glow: "#7f1d1d", tint: "rgba(220,38,38,0.1)"  },
};
```

In Monster Round, an additional `tint` div (`pointer-events: none; absolute inset-0; z-[1]`) overlays a subtle colour wash in the phase's accent hue.

---

## 18. Dev-Only Features

Controlled by `const IS_DEV = import.meta.env.DEV` (true in Vite dev server, false in production build).

### All levels freely accessible

In dev: all level buttons are clickable. In prod: levels must be unlocked sequentially.

### Answer hints

A small yellow badge appears inline next to every question, showing the correct answer:
- Level 1/2: badge at the right end of the question panel showing `{answer.toFixed(1)}`
- Level 3: badge beside each step's prompt showing `{subAnswers[i].toFixed(1)}`

### Clickable eggs (jump to egg count)

In dev mode, each egg in the top bar is clickable. Clicking egg `i` (0-indexed) calls `devSetEggs(i)`:
- If `gamePhase === "normal"` and `i+1 === 10` → triggers Monster Round
- If `gamePhase === "normal"` and `i+1 < 10` → sets `eggsCollected = i+1` and generates a new question
- If `gamePhase === "monster"` and `i+1 === 10` → calls `earnMonsterEgg()` (completes round)
- If `gamePhase === "monster"` and `i+1 < 10` → sets `monsterEggs = i+1`

The next egg to earn is tinted **grey** (slate fill/stroke) instead of a ring. In dev, `title` shows "DEV: set to N eggs".

---

## 19. Build & Deployment

### Dev server

```bash
npm run dev
# kills any process on :4001 first, then starts Vite on :4001 strict
```

### Production build

```bash
npm run build
# runs: tsc -b && vite build
# output: dist/ with hashed asset filenames
```

### GitHub Actions (`.github/workflows/deploy.yml`)

Triggers on every push to `main`:
1. Checkout repo
2. Install Node 20
3. `npm ci`
4. `npm run build`
5. Deploy `./dist` to the `gh-pages` branch via `peaceiris/actions-gh-pages@v4`

The GitHub Pages site is served from the `gh-pages` branch. The `vercel.json` file adds permissive iframe headers for embedding.

---

## 20. Key Design Decisions

### Why one screen component?

All game state (level, phase, eggs, run, question, drag, odometer) is deeply interdependent. A single component with `useRef` for stable values avoids prop-drilling and context complexity while keeping state transitions explicit and auditable.

### Why native window pointer events instead of React synthetic events?

On mobile, React's synthetic `onPointerMove` / `onPointerUp` can be interrupted by the browser's scroll/pan gesture detection. Using `window.addEventListener` with `setPointerCapture` ensures the drag follows the finger even when it drifts far from the original touch target.

### Why refs for everything in the drag loop?

`useCallback` with `[run.config]` dependencies would re-register the window listeners on every new run. Instead, refs (`configRef`, `checkpointsRef`, `moveRexRef`, `gamePhaseRef`) are kept in sync every render so the single registered listener always reads fresh values.

### Why bidirectional range tracking (`minKm`/`maxKm`) instead of position-based coloring?

The dino can backtrack. Position-only coloring would un-color previously visited track when the dino retreats. The `[minKm, maxKm]` range captures the full extent of movement in both directions.

### Why snap zones at nodes?

Without snapping, floating-point arithmetic causes tiny odometer increments as the dino sits on a node while the user tries to start a new drag. The snap zones (15% of the shorter adjacent edge) create a dead zone where movement is absorbed, preventing jitter.

### Why Web Audio API instead of audio files?

Zero bundle size for audio. Infinite variation (randomised note patterns). Works offline as a PWA. No licensing issues. The 8-bit aesthetic is accurately reproduced with square/sawtooth oscillators.

### Why Monster Round instead of a second difficulty?

It creates a narrative climax ("you've mastered the map — now do it in your head!") and reuses the same question types and map system without requiring new content. The transition from white→golden eggs is a strong visual reward signal.

### Why procedural map generation per egg (not per level)?

Seeing the same map repeatedly allows the child to memorise rather than calculate. Generating a fresh map for every question ensures the child is actually performing arithmetic rather than recalling answers.
