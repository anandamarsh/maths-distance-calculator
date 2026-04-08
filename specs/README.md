# Trail Distance Calculator — Specs

This folder is the **single source of truth** for the Trail Distance Calculator game.
Reading every file in this folder should give an LLM enough information to reconstruct
the entire codebase from scratch without inspecting any source files.

---

## What this game is

Trail Distance Calculator is an arcade-style maths game built as a Progressive Web App.
A dinosaur travels across a procedurally generated trail map connecting named towns.
The player drags the dino, watches an odometer accumulate distance, and solves
decimal distance problems.

Core features:
- A **trail map** (SVG) where the child drags a dinosaur character
- An **odometer** display that accumulates distance as the dino moves
- A **question** the child answers using a decimal-capable numeric keypad
- **3 levels** of increasing difficulty (total, missing-leg, comparison)
- A **Monster Round** per level where the odometer is hidden, testing fluency
- A **session report** emailed as a PDF at level completion
- **Autopilot** for demos and end-to-end testing
- **Vudeo recording** for localhost promo/demo capture
- **i18n** — planned feature (see `specs/i18n.md`)
- **Sound** synthesised with Web Audio API (no files needed)
- **Social sharing** + embedded comments
- **PWA** support for offline play

---

## Tech stack

| Layer | Choice |
|-------|--------|
| UI framework | React 19 (strict mode) |
| Language | TypeScript 5.9, strict mode |
| Bundler | Vite 8 + `@vitejs/plugin-react` |
| Styling | Tailwind CSS v4 (`@tailwindcss/vite`) |
| Fonts | DSEG7Classic (numeric display) via `dseg` npm package |
| PDF | jsPDF 4 |
| Social sharing | react-share |
| Comments | disqus-react (DiscussIt wrapper) |
| API / email | Vercel serverless (`api/*.ts`) + Resend |
| Translation | Planned — OpenAI GPT-4o-mini via `/api/translate` |
| PWA | vite-plugin-pwa (Workbox) |
| Testing | Playwright |
| Dev server port | **4001** (hard-coded in `vite.config.ts`) |

---

## Directory structure

```
/
├── api/
│   ├── send-report.ts        # Vercel serverless: email PDF via Resend
│   └── translate.ts          # Vercel serverless: on-demand OpenAI translation (planned)
├── public/
│   ├── favicon.ico / favicon.svg
│   ├── apple-touch-icon.png
│   ├── icon-192.png / icon-512.png
│   ├── manifest.json
│   └── screenshots/
├── scripts/
│   └── stamp-manifest.mjs    # build-time: injects version stamp into manifest
├── src/
│   ├── components/
│   │   ├── AutopilotIcon.tsx
│   │   ├── PhantomHand.tsx
│   │   ├── RotatePrompt.tsx
│   │   ├── SessionReportModal.tsx
│   │   ├── Social.d.ts
│   │   └── Social.jsx
│   ├── game/
│   │   ├── dinos.ts          # dinosaur SVG sprite library
│   │   └── levelOne.ts       # trail config + question generators for all 3 levels
│   ├── hooks/
│   │   ├── useCheatCode.ts
│   │   ├── useDistanceAutopilot.ts
│   │   └── useVudeoRecorder.ts
│   ├── report/
│   │   ├── generatePdf.ts
│   │   ├── sessionLog.ts
│   │   ├── sessionLog.test.ts
│   │   └── shareReport.ts
│   ├── screens/
│   │   └── ArcadeLevelOneScreen.tsx  # main game screen (all 3 levels)
│   ├── sound/
│   │   └── index.ts
│   ├── App.tsx
│   ├── index.css
│   └── main.tsx
├── tests/
│   └── autopilot.spec.ts
├── index.html
├── package.json
├── vite.config.ts
├── vercel.json
├── tsconfig.json / tsconfig.app.json / tsconfig.node.json
└── playwright.config.ts
```

---

## Feature index

| Feature | Spec | Key files |
|---------|------|-----------|
| [Architecture & CSS](./architecture.md) | `specs/architecture.md` | `index.css`, `index.html`, `App.tsx`, `main.tsx` |
| [Game Logic](./game-logic.md) | `specs/game-logic.md` | `game/levelOne.ts`, `game/dinos.ts` |
| [Game Loop](./game-loop.md) | `specs/game-loop.md` | `screens/ArcadeLevelOneScreen.tsx` |
| [Session Reporting](./session-reporting.md) | `specs/session-reporting.md` | `report/` |
| [Sound System](./sound-system.md) | `specs/sound-system.md` | `sound/index.ts` |
| [Autopilot](./autopilot.md) | `specs/autopilot.md` | `hooks/useDistanceAutopilot.ts`, `components/PhantomHand.tsx`, `components/AutopilotIcon.tsx` |
| [Vudeo Recording](./vudeo.md) | `specs/vudeo.md` | `hooks/useVudeoRecorder.ts`, `components/VudeoOverlay.tsx`, `public/intro.html`, `public/outro.html` |
| [Cheat Codes](./cheat-codes.md) | `specs/cheat-codes.md` | `hooks/useCheatCode.ts` |
| [i18n](./i18n.md) | `specs/i18n.md` | planned: `i18n/`, `components/LanguageSwitcher.tsx`, `api/translate.ts` |
| [Social & Comments](./social.md) | `specs/social.md` | `components/Social.jsx` |
| [Deployment & PWA](./deployment.md) | `specs/deployment.md` | `vite.config.ts`, `vercel.json`, `public/manifest.json` |
