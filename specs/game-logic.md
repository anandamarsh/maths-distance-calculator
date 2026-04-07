# Game Logic

**Files:**
- `src/game/levelOne.ts` — trail config + question generators for all 3 levels
- `src/game/dinos.ts` — dinosaur SVG sprite library

---

## Trail config

### `TrailStop`

```ts
export interface TrailStop {
  id: string;        // e.g. "P0", "P1", "P2"
  label: string;     // place name, e.g. "Newtown"
  x: number;        // SVG user-space x coordinate
  y: number;        // SVG user-space y coordinate
}
```

### `TrailEdge`

```ts
export interface TrailEdge {
  from: string;      // stop id
  to: string;        // stop id
  distance: number;  // in km or mi, 1 decimal place
}
```

### `TrailConfig`

```ts
export interface TrailConfig {
  id: string;        // unique, e.g. "1234567890-abc123"
  unit: "km" | "mi";
  palette: {
    bg: string;      // outer background colour
    bgGlow: string;  // ambient glow behind the trail
    panel: string;   // HUD panel background
    trail: string;   // unvisited trail line colour
    visited: string; // forward-traversed trail colour
    repeated: string;// backward-traversed trail colour
    node: string;    // stop circle fill
    text: string;    // stop label text
    accent: string;  // active-stop highlight colour
  };
  stops: TrailStop[];
  edges: TrailEdge[];
}
```

### `generateTrailConfig(level = 1): TrailConfig`

Creates a procedurally generated trail:
- **Level 1**: 3–5 stops
- **Level 2+**: 5–6 stops (more stops allow longer multi-hop routes)
- Places chosen from a 30-item pool of Sydney suburb names (shuffled each call)
- Palette chosen at random from 4 built-in palettes
- Unit: 55% chance km, 45% chance mi
- Edge distances: random decimal in range [1.5, 9.9] (km) or [1.5, 8.9] (mi)
- Stop x positions: evenly spaced between x=110 and x=1170
- Stop y positions: first and last at y=340, middle stops ±80px vertical jitter

**4 built-in palettes:**

| Name | bg | visited | repeated |
|------|----|---------|----------|
| Dark indigo | `#111827` | `#facc15` | `#e879f9` |
| Deep blue | `#172554` | `#4ade80` | `#fb923c` |
| Dark red | `#3f0d12` | `#fde047` | `#38bdf8` |
| Dark green | `#0f1a10` | `#fbbf24` | `#a78bfa` |

---

## Question types

### `TrailQuestion`

```ts
export interface TrailQuestion {
  id: string;
  route: number[];           // stop indices making up the route
  prompt: string;            // full question text
  answer: number;            // correct answer (1 decimal place)

  // Level 2 only
  hiddenEdge?: number;       // index of the edge whose label is "?"
  totalGiven?: number;       // total distance shown to child

  // Level 3 only
  promptLines?: [string, string, string];  // 3-step sub-prompts
  subAnswers?: [number, number, number];   // [distA, distB, difference]
  hubStop?: number;          // index of the shared hub stop
  legA?: number;             // edge index for one arm
  legB?: number;             // edge index for the other arm
}
```

### Level 1: Total distance

Find the sum of distances along 1–3 hops.

```
Rex wants to go from Newtown to Ashfield. How far should Rex travel?
Rex goes from Newtown → Ashfield → Marrickville. How far should Rex travel in total?
```

Generator: `generateLevelOneQuestions(config, count, dinoName)`
- Routes of 1–3 hops, never the same route twice
- Answer = sum of edge distances along the route

### Level 2: Missing leg

The total is given; one leg is hidden. Find the missing distance.

```
The total distance from Newtown to Marrickville is 8.4 km.
What is the missing distance from Ashfield to Marrickville?
```

Generator: `generateLevelTwoQuestions(config, count)`
- Routes of 2–5 hops (forward direction only)
- One edge in the route is selected as the hidden leg (shown as "?" on map)
- Answer = hidden edge distance
- `totalGiven` = full route distance (shown to child)
- `hiddenEdge` = edge index within `config.edges`

### Level 3: Hub comparison

From a shared hub, compare two arm distances.

**Scaffold (3 steps):**
```
How far is it from Ashfield to Newtown?     → [answer: 3.2]
How far is it from Ashfield to Marrickville? → [answer: 5.6]
From Ashfield, how much farther is it to Marrickville than to Newtown? → [answer: 2.4]
```

Generator: `generateLevelThreeQuestions(config, count)`
- Picks a hub stop that has an edge on both sides
- The two arms are the edges immediately left and right of the hub
- Skips if the two arm distances are equal (within 0.05)
- `promptLines`: the three sub-prompts in order
- `subAnswers`: `[distA, distB, |distA - distB|]` where distA/B are the two arm distances

---

## Single-question generator

```ts
export function makeOneQuestion(config: TrailConfig, level: number, dinoName = "Rex"): TrailQuestion
```

Dispatches to the appropriate level generator and returns one question.
Used after every correct/wrong answer to advance the game.

---

## Route geometry helpers

```ts
export function routeDistance(route: number[], edges: TrailEdge[]): number
// Sum distances of edges between consecutive stops in route.
// Returns value rounded to 1 decimal place.
```

Used internally to compute answers and totals.

**In-screen helpers:**

```ts
function totalKm(config: TrailConfig): number
// Sum all edge distances (3 decimal precision for internal use).

function getCheckpoints(config: TrailConfig): number[]
// Returns array of cumulative km values at each stop boundary.
// e.g. [0, 3.2, 7.8, 12.1]

function posAtKm(config: TrailConfig, km: number, checkpoints: number[]): { x, y }
// Interpolates SVG position along the trail at a given km value.
// Used to position the dino token and compute autopilot drag paths.

function projectToTrail(config: TrailConfig, svgX: number, svgY: number, checkpoints: number[]): number
// Given an SVG point (from pointer drag), finds the nearest point on
// any trail edge and returns the corresponding km value.
// Used to convert pointer drag events to odometer readings.

function shouldFaceLeftForRoute(route: number[]): boolean
// Returns true if route direction is right-to-left (final stop index < start).
// Controls horizontal flip of the dino sprite.
```

---

## Dinosaur sprites

**File:** `src/game/dinos.ts`

6 pre-built SVG sprites from [game-icons.net](https://game-icons.net), CC BY 3.0 license.

```ts
export interface DinoSprite {
  id: string;
  name: string;       // formal name, e.g. "Velociraptor"
  nickname: string;   // friendly name used in question prompts
  author: string;     // e.g. "Delapouite"
  license: string;    // "CC BY 3.0"
  url: string;        // attribution URL
  path: string;       // SVG path d attribute (viewBox 0 0 512 512)
}
```

| id | name | nickname |
|----|------|---------|
| `velociraptor` | Velociraptor | Blaze |
| `ninja-velociraptor` | Ninja Velociraptor | Shadow |
| `diplodocus` | Diplodocus | Stretch |
| `parasaurolophus` | Parasaurolophus | Crest |
| `dimetrodon` | Dimetrodon | Spike |
| `pterodactylus` | Pterodactylus | Talon |

```ts
export function randomDino(): DinoSprite
// Returns a random sprite from the pool.
```

**Dino colors** (6 options, cycle with palette — picked at random per run):
```ts
const DINO_COLORS = [
  "#22c55e", "#34d399", "#4ade80", "#86efac", "#a3e635", "#facc15",
];
```

### `RexSprite` sub-component (inline in screen)

```tsx
function RexSprite({ dino, dinoColor, facingLeft, showAttachedAutopilotHand })
```

- Renders an SVG `<g>` with the dino path at (–50, –100), width/height 100×100
- `facingLeft`: applies `scaleX(-1)` transform
- `showAttachedAutopilotHand`: when autopilot is driving the route, shows a cyan
  hand SVG attached to the dino to indicate it is being controlled

---

## Trail SVG rendering

The map canvas is a full-width SVG element with a dynamically computed `viewBox`
that tightly fits all stop positions.

**viewBox calculation:**
```ts
const padTop = 120;    // room above top stop
const padBottom = 60;  // room below bottom stop
const padSide = 80;    // room for label text either side

const vbX = Math.min(...xs) - padSide;
const vbY = Math.min(...ys) - padTop;
const vbW = Math.max(...xs) - Math.min(...xs) + padSide * 2;
const vbH = Math.max(...ys) - Math.min(...ys) + padTop + padBottom;
```

**Layer order (bottom to top):**
1. Background radial gradient (per level × phase — see game-loop.md)
2. Trail lines (unvisited segment: `palette.trail`, width 8)
3. Visited-forward segments: `palette.visited`, width 8
4. Visited-backward segments: `palette.repeated`, width 8
5. Edge distance labels (centered above each edge)
6. Stop markers (`StopMarker` component)
7. Dino token (`RexSprite` component)

**`StopMarker` sub-component:**
- Circle r=24 (r=30 when active/highlighted)
- Active stops show an additional glow circle at r+14 with 16% opacity
- Endpoint stops (first/last of route) show "S" / "F" letter glyphs
- Level 3: endpoint letters hidden (dots only), to emphasise the hub structure
- Stop labels below each node: 21px, fontWeight 800, stroke painted white+black

**`ColoredPrompt` sub-component:**
- Renders the question text with numbers highlighted in `text-yellow-300 font-black`
- Place names (from `stopLabels`) highlighted in `text-yellow-200 font-black`

---

## Place name pool

30 Sydney suburb names drawn at random per trail generation:

```ts
const PLACE_POOL = [
  "Newtown", "Ashfield", "Marrickville", "Leichhardt", "Erskineville",
  "Redfern", "Tempe", "Sydenham", "Enmore", "Stanmore",
  "Petersham", "Dulwich", "Rozelle", "Balmain", "Drummoyne",
  "Concord", "Rhodes", "Burwood", "Strathfield", "Homebush",
  "Croydon", "Lidcombe", "Bankstown", "Lakemba", "Belmore",
  "Hurstville", "Kogarah", "Rockdale", "Sylvania", "Miranda",
];
```

Each run shuffles the pool and takes the first `stopCount` entries.
