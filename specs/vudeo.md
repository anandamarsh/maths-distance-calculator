# Vudeo Recording

**Files:**
- `src/hooks/useVudeoRecorder.ts` — tab-capture recording state machine + `MediaRecorder`
- `src/components/VudeoOverlay.tsx` — holding screen, intro iframe, outro iframe
- `public/intro.html` — editable intro template rendered directly in an iframe
- `public/outro.html` — editable outro template rendered directly in an iframe
- Integration in `src/screens/ArcadeLevelOneScreen.tsx`

---

## What it does

Adds a localhost-only "vudeo" recorder for generating a full promo/demo capture of
Trail Distances for YouTube uploads.

The recorder:
- switches to a dark holding screen before browser capture permission is requested
- records the current tab with `navigator.mediaDevices.getDisplayMedia()`
- shows a timed intro slide from `public/intro.html`
- resets the game to Level 1 and runs continuous autopilot through all levels
- uses the fixed demo email `teacher@myschool.com` in the report modal
- shows a timed outro slide from `public/outro.html`
- downloads a `.webm` file automatically when finished

This is adapted from the template repo's `demo-video` feature, but documented here
against the actual Trail Distances implementation.

---

## Trigger

A video camera button appears in the top-left localhost dev toolbar immediately after
the existing screenshot button.

- Visible only when `import.meta.env.DEV` and hostname is `localhost`, `127.0.0.1`,
  or `::1`
- Hidden while recording is active
- Tooltip/title: `"Record demo video"`

---

## Recording flow

### 1. Holding screen + permission

When the button is pressed:

1. The app enters recording phase `"intro-prompt"`
2. A full-screen dark holding screen is rendered
3. Only after that screen is mounted does the app call `getDisplayMedia()`
4. If the browser permission prompt is denied or cancelled, recording is aborted and
   the app returns to its normal state with no file download

The capture request is:

```ts
navigator.mediaDevices.getDisplayMedia({
  video: {
    displaySurface: "browser",
    width: { ideal: 1920 },
    height: { ideal: 1080 },
    frameRate: { ideal: 30 },
  },
  audio: true,
  preferCurrentTab: true,
});
```

### 2. Intro

After capture is granted and the recorder has started:

- `public/intro.html` is shown in a fullscreen iframe
- Total intro read time is 10 seconds
- `intro.html` internally handles a two-panel sequence:
  - Panel 1 for 4 seconds
  - Panel 2 for 6 seconds
- The overlay then fades out

Intro content is specific to this game:
- Title: `Trail Distances`
- Subtitle: decimal distance / map problem solving
- Stage reference: Stage 3 (Years 5-6) NSW curriculum
- Outcome references: `MA3-7NA` and `MA3-9MG`
- Description: dragging along a route, reading the odometer, solving totals, missing
  legs, and comparison questions

### 3. Gameplay capture

When the intro completes:

1. The game resets to Level 1
2. Continuous autopilot starts
3. The in-game music is kept visually muted, so the mute icon stays in its muted
   state during the recording
4. A dedicated recording-only soundtrack starts under the intro, is not controlled
   by the mute button, and continues through gameplay and outro
5. The autopilot uses the fixed email address `teacher@myschool.com`
6. Video recordings use a shorter progression target of **2 eggs per level**
7. The run continues through all 3 levels and their report modals

### 4. Outro

When continuous autopilot finishes the final level:

- `public/outro.html` is shown in a fullscreen iframe
- It holds for 5 seconds
- It fades out over an opaque dark background
- Recording stops only after the outro finishes

The outro promotes SeeMaths and keeps the URL visible on screen:
- "Play this and more games at"
- `SeeMaths.com`
- `www.seemaths.com`

### 5. Download

After the outro fade completes, the recorded chunks are assembled into a WebM and
downloaded automatically as:

```txt
trail-distances-vudeo-{timestamp}.webm
```

---

## MediaRecorder configuration

```ts
const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
  ? "video/webm;codecs=vp9,opus"
  : MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")
    ? "video/webm;codecs=vp8,opus"
    : "video/webm";

new MediaRecorder(stream, {
  mimeType,
  videoBitsPerSecond: 5_000_000,
});
```

---

## Phases

`useVudeoRecorder()` exposes:

```ts
type RecordingPhase =
  | "idle"
  | "intro-prompt"
  | "intro"
  | "playing"
  | "outro"
  | "stopping";
```

Behavior:
- `"idle"` — no recording UI
- `"intro-prompt"` — dark holding screen while capture permission is pending
- `"intro"` — intro iframe visible and timers running
- `"playing"` — live game capture is running
- `"outro"` — outro iframe visible
- `"stopping"` — recorder has been told to stop and is finalising download

---

## Audio behavior

The recording flow matches the template repo's intended pattern:

- the normal in-game music stays muted, so the mute icon remains visually muted
- game sound effects still play and are captured
- a separate recording-only soundtrack bus is mixed into the tab audio for the full
  intro → gameplay → outro sequence
- that soundtrack fades in at the start and fades out with the outro

---

## UI details

- The normal audio button stays visible while gameplay recording is active
- The video-record button is hidden while recording is active
- A pulsing red recording dot appears in the top-left corner during the gameplay
  portion of the recording

---

## Cleanup

When recording stops or tab sharing is ended from browser chrome:

- all stream tracks are stopped
- recorder refs and chunk buffers are cleared
- autopilot is cancelled if still active
- recording phase returns to `"idle"`
