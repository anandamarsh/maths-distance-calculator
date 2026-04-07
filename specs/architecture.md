# Architecture & CSS System

## Entry point

**`index.html`** — single-page app shell:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <link rel="manifest" href="/manifest.json" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#0d1b35" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="Distance Calculator" />
    <title>Trail Distance Calculator</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

**`src/main.tsx`** — React 19 strict mode mount:
```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
createRoot(document.getElementById('root')!).render(
  <StrictMode><App /></StrictMode>
)
```

**`src/App.tsx`** — wraps the game screen and rotate prompt:
```tsx
import ArcadeLevelOneScreen from "./screens/ArcadeLevelOneScreen";
import RotatePrompt from "./components/RotatePrompt";
export default function App() {
  return (
    <>
      <RotatePrompt />
      <ArcadeLevelOneScreen />
    </>
  );
}
```

Note: `App.tsx` does not yet wrap in an `I18nProvider`. When i18n is added,
it will wrap both children in `<I18nProvider>`. See `specs/i18n.md`.

---

## TypeScript config

`tsconfig.json` references `tsconfig.app.json` and `tsconfig.node.json`.

`tsconfig.app.json` key settings:
```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "jsx": "react-jsx"
  }
}
```

---

## Vite config (`vite.config.ts`)

Plugins: react, tailwindcss, `localApiPlugin()`, VitePWA.

Dev server: `port: 4001, strictPort: true`.

**`localApiPlugin()`** — custom Vite plugin that reads `.env.local` and mounts
dev middleware routes mirroring the Vercel serverless functions:
- `POST /api/send-report` → calls Resend

**VitePWA** config:
```ts
VitePWA({
  registerType: 'autoUpdate',
  includeAssets: ['favicon.ico', 'favicon.svg', 'apple-touch-icon.png', 'icon-192.png', 'icon-512.png'],
  manifest: false,  // manifest.json is manually managed in public/
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
    runtimeCaching: [{
      urlPattern: /^https:\/\//,
      handler: 'NetworkFirst',
      options: { cacheName: 'external-cache', networkTimeoutSeconds: 10 },
    }],
  },
})
```

**`stamp-manifest.mjs`** — build script that injects a version/timestamp into
`public/manifest.json` before the Vite build and restores it afterwards.
Run via `prebuild` / `postbuild` npm lifecycle hooks.

---

## CSS system (`src/index.css`)

### Font setup

```css
@import "tailwindcss";

@font-face {
  font-family: 'DSEG7Classic';
  src: url('dseg/fonts/DSEG7-Classic/DSEG7Classic-Regular.woff2') format('woff2'),
       url('dseg/fonts/DSEG7-Classic/DSEG7Classic-Regular.woff') format('woff');
  font-weight: 400;
}
@font-face {
  font-family: 'DSEG7Classic';
  src: url('dseg/fonts/DSEG7-Classic/DSEG7Classic-Bold.woff2') format('woff2'),
       url('dseg/fonts/DSEG7-Classic/DSEG7Classic-Bold.woff') format('woff');
  font-weight: 700;
}

:root {
  font-family: "Courier New", "Lucida Console", monospace;
  color: #f8fafc;
  background: #020617;
}
body { margin: 0; }
#root { min-height: 100svh; }
```

### Keyframe animations

| Name | Description | Usage |
|------|-------------|-------|
| `bounce-in` | scale 0.3→1.08→1, opacity 0→1 | modal entry |
| `shake` | horizontal ±8px wobble | wrong answer |
| `pop` | scale 1→1.18→1 | button press |
| `float` | vertical ±8px sine, 3s | tutorial hint |
| `ripple-expand` | scale 0→1, opacity 0.9→0 | (template legacy) |
| `keypad-display-finger-fade` | opacity 0.35↔1 | keypad idle hint |
| `autopilot-blink` | opacity 0.3↔1, glow 0→14px, 2s | autopilot robot icon |

### Arcade utility classes

**.font-arcade** — monospace with 0.06em letter spacing.

**.arcade-grid** — dark grid background (22×22px, white lines at 6% opacity).

**.arcade-panel** — game widget panel:
```css
border: 4px solid rgba(255,255,255,0.7);
border-radius: 14px;
background: rgba(15, 23, 42, 0.97);
box-shadow: 0 0 0 4px rgba(15,23,42,0.8), 0 18px 40px rgba(0,0,0,0.3);
```

**.digital-meter** — DSEG7 numeric display style:
```css
font-family: 'DSEG7Classic', "Courier New", monospace;
font-weight: 700;
letter-spacing: 0.12em;
text-shadow: 0 0 14px rgba(103,232,249,0.6);
font-variant-numeric: tabular-nums lining-nums;
```

**.arcade-button** — orange pill button with yellow border:
```css
border: 3px solid #fef08a;
border-radius: 9999px;
background: linear-gradient(180deg, #f97316, #ea580c);
color: white;
font-weight: 900;
letter-spacing: 0.1em;
text-transform: uppercase;
```

---

## Device detection hooks (inline in `ArcadeLevelOneScreen.tsx`)

Three local media query hooks (not shared components — defined at the top of the screen file):

```ts
function useIsMobileLandscape(): boolean
// true if: touch device AND orientation === landscape
// matchMedia: "(hover: none) and (pointer: coarse) and (orientation: landscape)"

function useIsSmallMobileLandscape(): boolean
// true if: mobile landscape AND max-height 430px
// matchMedia: "... and (max-height: 430px)"

function useIsCoarsePointer(): boolean
// true if: matchMedia("(hover: none) and (pointer: coarse)")
```

All hooks use `window.matchMedia` and update on change via event listener.

---

## Package scripts

```json
"dev":             "lsof -ti :4001 | xargs kill -9 2>/dev/null; vite"
"prebuild":        "node scripts/stamp-manifest.mjs stamp"
"build":           "tsc -b && vite build"
"postbuild":       "node scripts/stamp-manifest.mjs restore"
"lint":            "eslint ."
"preview":         "vite preview"
"test:autopilot":  "playwright test"
```

---

## Key constants (defined in `ArcadeLevelOneScreen.tsx`)

```ts
const IS_DEV = import.meta.env.DEV;
const ANSWER_CHEAT_CODE = "197879";
const AUTOPILOT_EMAIL = import.meta.env.VITE_AUTOPILOT_EMAIL ?? "amarsh.anand@gmail.com";
const IS_LOCALHOST_DEV = IS_DEV && ["localhost", "127.0.0.1", "::1"].includes(hostname);

const DEFAULT_EGGS_PER_LEVEL = 10;      // normal eggs needed to trigger Monster Round
const AUTOPILOT_EGGS_PER_LEVEL = 5;     // reduced eggs in autopilot mode
const SUCCESS_ICON_DURATION_MS = 1100;  // duration of correct/wrong flash icon

const KEYPAD_DISPLAY_FONT_SIZE = "2.1rem";
const ODOMETER_MAIN_WIDTH = "4ch";      // fixed width for DSEG7 readout
```

`IS_LOCALHOST_DEV` enables a dev-only screenshot capture button.

---

## DSEG7 font for PDF

The PDF generator needs the DSEG7 font embedded as a data URL so jsPDF can
render it without relying on system fonts. The screen loads the font data URLs
at module level:

```ts
import dsegRegularWoff2Url from "dseg/fonts/DSEG7-Classic/DSEG7Classic-Regular.woff2?url";
import dsegBoldWoff2Url from "dseg/fonts/DSEG7-Classic/DSEG7Classic-Bold.woff2?url";

async function toDataUrl(url: string, mimeType: string): Promise<string>
// Fetches the woff2, reads as ArrayBuffer, converts to data URL.
// Results are cached in a module-level Map to avoid re-fetching.
```
