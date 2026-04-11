# Cheat Code System

**File:** `src/hooks/useCheatCode.ts`

---

## How it works

A global `keydown` listener (capture phase) accumulates digit keypresses into a
rolling buffer (max 12 characters). The same buffer is also exposed through
`processCheatKey(...)` so the in-game keypad can trigger codes on mobile.

Non-digit keys (except modifier keys) reset the buffer.

```ts
const BUFFER_MAX = 12;
const PASSTHROUGH_KEYS = new Set([
  "Shift", "Control", "Alt", "Meta", "CapsLock", "Tab", "NumLock",
]);

export function useCheatCodes(handlers: Record<string, () => void>): {
  processCheatKey: (key: string) => boolean;
  resetCheatBuffer: () => void;
}
```

`handlers` is a map from code string → callback. The hook uses a ref for `handlers`
so adding/removing codes during a render does not re-attach the listener.

The listener uses `{ capture: true }` priority, and calls `e.stopImmediatePropagation()`
when a code fires — preventing the triggering digit from reaching other listeners.

`processCheatKey(key)` returns `true` when a code matched. Keypad components must
check that first so the trigger digits do not stay visible in the on-screen
display.

---

## Standard codes (all games)

| Code | Action |
|------|--------|
| `198081` | Toggle continuous autopilot on/off |
| `197879` | Submit the correct answer immediately (in answering phase) |

### `197879` implementation in screen:

```ts
"197879": () => {
  if (cheatAnswerUnlocked) return;
  setCheatAnswerUnlocked(true);
  setCalcValue(String(currentQ.answer));
  keypadValueRef.current = String(currentQ.answer);
  // For Level 3: advance to final step if not already there
  requestAnimationFrame(() => submitAnswerRef.current());
}
```

### `198081` implementation in screen:

```ts
"198081": () => {
  singleQuestionDemoRef.current = false;
  if (isAutopilot && autopilotMode === "continuous") {
    deactivateAutopilot();
  } else {
    if (isAutopilot) deactivateAutopilot();
    setAutopilotMode("continuous");
    setCalcValue("");
    activateAutopilot();
  }
}
```

---

## Adding game-specific codes

Pass additional entries to `useCheatCodes`:

```ts
useCheatCodes({
  "197879": () => { /* show answer */ },
  "198081": () => { /* toggle autopilot */ },
  "111222": () => { /* game-specific shortcut */ },
});
```

Codes can be any string of digits up to 12 characters.
Shorter codes fire more easily — avoid codes that are substrings of others.

## Required keypad integration

Trail Distances uses an in-screen keypad, so cheat codes must work from:
- hardware keyboards
- on-screen keypad taps

The keypad `press(key)` path must call `onKeyInput?.(key)` before appending the
key to the answer field. If that returns `true`, the keypad must stop and leave
the display blank/reset according to the cheat handler.
