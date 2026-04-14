# Canvas & SVG Scene — Distance Calculator

**File:** `src/screens/ArcadeLevelOneScreen.tsx`

The game scene is rendered as an inline SVG. There is no HTML canvas element — all graphics are SVG paths, shapes, lines, and text nodes.

---

## SVG viewport

```ts
// Level 1 & 3: square map
const W = 512;   // viewBox width
const H = 512;   // viewBox height (adjusted at render time to a "tight" viewBox)

// Level 2: square map
// viewBox="0 0 500 500"
```

The outer SVG uses a dynamically computed `tightViewBox` (a substring of the full grid) so the trail always fills the visible map area regardless of screen ratio. It fills its container via CSS (`width: 100%; height: 100%`) in a `position: absolute; inset: 0` wrapper.

---

## Coordinate system

Standard SVG coordinates: origin top-left, x increases right, y increases down.

Grid squares are laid out as a 2D array. Each cell has a pixel position derived from its row/column index. The dino character sprite is centred at the current grid cell position and moves between cells during animation.

---

## Scene layers (SVG render order)

1. **Grid / map background** — grid lines or road texture
2. **Trail path** — the route the dino has walked, rendered as a polyline
3. **Dino sprite** — SVG path at the current position; three variants (level 1, 2, 3) with different path data and fill colours
4. **Odometer overlay** — HTML element (not SVG) layered on top via absolute positioning; shows the DSEG7 digital distance readout
5. **Autopilot phantom hand** — SVG group attached to dino position when autopilot is active

---

## Dino sprite

Three level-specific dino SVG paths rendered inside a `<g>` translated to `(CX, CY)`:

- **Level 1** — standard dino path, `fill={dinoColor}`, stroke `rgba(255,245,235,0.7)`, strokeWidth 14
- **Level 2** — large dino silhouette path (different shape), `fill={dinoColor}`, stroke `rgba(255,247,237,0.38)`, strokeWidth 8
- **Level 3** — cyclist/runner silhouette path

The dino can be horizontally flipped (`scaleX(-1)`) when moving left.

---

## Scene capture

### Full-scene capture

```ts
async function renderQuestionPngBlob(scale = 2): Promise<Blob>
```

- Clones the scene SVG element
- Sets `tightViewBox` on the clone so the exported image matches what's on screen
- Embeds DSEG7Classic fonts as data URLs (required for the odometer panel text)
- Serialises the SVG to a data URL, draws it onto an offscreen `<canvas>` at `scale` × resolution
- Overlays the odometer panel (box + styled numeric text) onto the canvas
- Returns a PNG blob

Triggered by `handleCaptureQuestion()`. Gated behind `IS_LOCALHOST_DEV`. Filename: `distance-scene-{timestamp}.png`.

### Square snip tool

```ts
type SnipSelection = { x: number; y: number; size: number };
type SnipDragState = { mode: "move" | "resize"; pointerId: number; startX: number; startY: number; initial: SnipSelection };
```

- Activated by a second toolbar icon (camera + crop icon); gated to `IS_LOCALHOST_DEV`
- Overlay is positioned in **client-pixel space** over the rendered SVG, not in SVG units — tracks the visible viewport
- Default selection: `makeDefaultSnipSelection()` — centred square, size = `min(vw, vh) × 0.48`, clamped `[96, 220]px`
- Dragging the centre handle moves the whole selector
- Dragging the bottom-right resize handle changes width and height together (always stays square)
- `clampSnipSelection()` keeps the selection within the map bounds; minimum size 72px
- On capture: renders full image at `scale=4`, crops to the selected square bounds on an offscreen canvas, then calls `shareOrDownloadPng()`
- Filename: `distance-square-snip-{timestamp}.png`

### Capture flash effect

```ts
function triggerCaptureFlash(): void
// Plays playCameraShutter() SFX
// Shows a full-screen white radial-gradient overlay (z-index 120) for 180ms
```

### Share / download

```ts
async function shareOrDownloadPng(blob: Blob, filename: string, title: string, text: string): Promise<void>
// On mobile / PWA (navigator.standalone || matchMedia pointer:coarse): Web Share API
// Otherwise: download via <a download> anchor
// Shows flash message on success or failure
```

---

## `IS_LOCALHOST_DEV` gate

```ts
const IS_LOCALHOST_DEV =
  IS_DEV &&
  new Set(["localhost", "127.0.0.1", "::1"]).has(globalThis.location?.hostname ?? "");
```

All capture and snip UI is hidden in production. In dev, two extra toolbar buttons appear:
- **Capture scene** — full SVG + odometer PNG
- **Square snip tool** — toggle square crop overlay

---

## Snip overlay UI (JSX)

Rendered only when `IS_LOCALHOST_DEV && snipMode && activeSnipSelection`:

- Semi-transparent dark vignette behind the selection
- Dashed white border around selected square
- Three buttons on the border:
  - Camera icon (top-left): triggers `handleCaptureSnip()`
  - Close icon (top-right): `closeSnipMode()`
  - Drag handle (centre): pointer-down starts `mode: "move"` drag
  - Resize handle (bottom-right, circular glowing): pointer-down starts `mode: "resize"` drag
- `keydown` listener: Escape closes the tool
- `resize` listener: re-clamps selection on window resize
