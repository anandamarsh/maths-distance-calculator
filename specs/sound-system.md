# Sound System

**File:** `src/sound/index.ts`

Web Audio API synthesis — no external audio files. All sounds are generated in code
using oscillators and noise. Background music is muted by default in development.

---

## Module-level state

```ts
let ctx: AudioContext | null = null;
let footToggle = false;      // alternates L/R foot for realistic footstep sound
let musicMuted = import.meta.env.DEV;  // true in dev, false in production
const MUSIC_VOLUME_SCALE = 0.25;
const SFX_VOLUME_SCALE = 1;
```

`ac()` lazily creates the AudioContext and resumes it if suspended.

---

## Core primitives

### `tone(freq, start, dur, vol, type, channel)`

Plays a single oscillator tone. Music channel tones are silenced when `musicMuted`.

### `noiseBurst(startTime, filterFreq, vol, dur, channel)`

White noise through a bandpass filter (Q=1.8). Used for percussive/impact textures.

---

## Exported SFX functions

### `playStep()`

Footstep sound fired every 0.35 km of dino movement.

```ts
export function playStep() {
  const t = ac().currentTime;
  footToggle = !footToggle;
  const side = footToggle ? 1 : -1;
  noiseBurst(t, 420 + side * 60, 0.36, 0.06);  // sharp impact crack (L/R alternating)
  tone(footToggle ? 72 : 88, t, 0.1, 0.3, "sine"); // low bass thud (alternating pitch)
  noiseBurst(t, 2800, 0.14, 0.022);               // subtle high tick
}
```

### `playCorrect()`

Ascending major chord arpeggio — same as template:
```ts
tone(110, t, 0.08, 0.18, "sine");           // bass thump
tone(523.25, t, 0.12, 0.11, "square");      // C5
tone(659.25, t + 0.06, 0.15, 0.1, "square"); // E5
tone(783.99, t + 0.12, 0.15, 0.1, "square"); // G5
tone(1046.5, t + 0.18, 0.22, 0.12, "square"); // C6
tone(1318.5, t + 0.24, 0.28, 0.09, "triangle"); // E6 fade
```

### `playWrong()`

Descending sawtooth — losing buzzer:
```ts
tone(90, t, 0.1, 0.2, "sine");
tone(440, t, 0.12, 0.12, "sawtooth");
tone(349.23, t + 0.1, 0.15, 0.11, "sawtooth");
tone(261.63, t + 0.2, 0.18, 0.1, "sawtooth");
tone(196, t + 0.3, 0.22, 0.09, "sawtooth");
```

### `playLevelComplete()`

6-note melody (0.12s apart). Also played for each egg collected.

```ts
const melody = [523.25, 659.25, 783.99, 659.25, 783.99, 1046.5];
melody.forEach((f, i) => tone(f, t + i * 0.12, 0.2, 0.09));
```

### `playSnap()`

Two-tone snap/chime — used for checkpoint-related UI feedback:
```ts
tone(880, t, 0.06, 0.07, "square");
tone(1108.7, t + 0.05, 0.08, 0.06, "square");
```

### `playButton()`

Two-tone UI click for toolbar buttons:
```ts
tone(659.25, t, 0.05, 0.06, "square");
tone(783.99, t + 0.04, 0.05, 0.045, "square");
```

### `playKeyClick()`

Sharp percussive tick for keypad button presses:
```ts
noiseBurst(t, 2600, 0.14, 0.02);
tone(1900, t, 0.026, 0.08, "square");
```

### `playGoldenEgg()`

Sparkly golden sound when a white egg turns golden in Monster Round:
```ts
tone(880,    t,        0.08, 0.10, "square");
tone(1108.7, t + 0.07, 0.10, 0.10, "square");
tone(1318.5, t + 0.14, 0.12, 0.12, "triangle");
tone(1760,   t + 0.21, 0.18, 0.10, "triangle");
tone(2093,   t + 0.28, 0.22, 0.09, "triangle");
noiseBurst(t + 0.33, 3500, 0.07, 0.18);
```

### `playMonsterStart()`

Dramatic sting played when the Monster Round begins:
```ts
tone(55,      t,        0.18, 0.28, "sawtooth");
tone(110,     t + 0.06, 0.15, 0.22, "sawtooth");
tone(392,     t + 0.18, 0.14, 0.14, "square");
tone(349.23,  t + 0.34, 0.14, 0.13, "square");
tone(329.63,  t + 0.50, 0.14, 0.13, "square");
tone(261.63,  t + 0.66, 0.38, 0.17, "sawtooth");
noiseBurst(t + 0.66, 200, 0.15, 0.32);
```

### `playMonsterVictory()`

Full celebration fanfare when Monster Round is cleared:
- 4 sharp clap bursts (noise pairs at t=0, 0.22, 0.44, 0.58)
- 8-note triumphant ascending fanfare starting at t=0.75
- Second clap burst at t=1.8
- Final resolving chord at t=2.1 (C5/E5/G5 triangle, 0.5s)

### `playGameComplete()`

Grand finale when all 3 levels are completed:
- 6 clap bursts (t=0 to t=0.9, every 0.18s)
- 11-note two-octave rising fanfare (t=1.1 to t=2.85)
- Big clap burst at peak (t=2.85)
- Sustaining 4-note final chord (t=3.1 to 3.28, each 0.06s apart, 1.5s long)

---

## Mute controls

```ts
export function toggleMute(): boolean  // toggles musicMuted, returns new state
export function isMuted(): boolean     // returns current musicMuted state
export function isMusicOn(): boolean   // returns whether background music is running
```

`toggleMute` only affects background music. SFX (footsteps, correct/wrong, etc.)
always play regardless of mute state.

---

## Normal background music (6 patterns)

| Pattern | Name | BPM | Waveforms |
|---------|------|-----|-----------|
| 1 | Bouncy adventure | 140 | square / triangle |
| 2 | Upbeat march | 155 | square / triangle |
| 3 | Gentle explorer | 110 | triangle / sine |
| 4 | Energetic sprint | 170 | square / triangle |
| 5 | Mystery trail | 120 | square / triangle |
| 6 | Dino stomp | 130 | square / triangle |

```ts
export function startMusic(): void
// Picks a random pattern, starts tick loop.
// No-op if music is already playing.

export function shuffleMusic(): void
// Switches to a different pattern (no immediate restart).
// Call on level restart to change the song.

export function stopMusic(): void
// Halts the tick loop.
```

---

## Monster Round music (3 patterns)

Triggered by `switchToMonsterMusic()` when the Monster Round begins.
Switched back to normal patterns on level restart.

| Pattern | Name | BPM | Character |
|---------|------|-----|-----------|
| 1 | Boss battle | 160 | sawtooth / square, heavy minor key |
| 2 | Ominous creep | 125 | square / sawtooth, slow and dark |
| 3 | Jurassic rampage | 155 | sawtooth / triangle, driving |

```ts
export function switchToMonsterMusic(): void
// Immediately switches currentPattern to a random monster pattern.
// Step is reset to 0 so the new pattern starts from the beginning on the next tick.
```

---

## Tick loop

```ts
function tick() {
  if (!musicOn) return;
  const t = ac().currentTime;
  const beat = 60 / currentPattern.bpm;
  if (melody[step]) tone(melody[step], t, beat * 0.7, melodyVol, melodyType, "music");
  if (bass[step])   tone(bass[step], t, beat * 0.9, bassVol, bassType, "music");
  step = (step + 1) % melody.length;
  bgTimer = setTimeout(tick, beat * 1000);
}
```

Notes last `beat * 0.7` (melody) and `beat * 0.9` (bass).
