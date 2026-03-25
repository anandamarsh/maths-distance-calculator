let ctx: AudioContext | null = null;
let footToggle = false;
let muted = false;

function ac(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function tone(freq: number, start: number, dur: number, vol = 0.08, type: OscillatorType = "square") {
  if (muted) return;
  const c = ac();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.connect(gain);
  gain.connect(c.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(vol, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
  osc.start(start);
  osc.stop(start + dur + 0.01);
}

export function toggleMute(): boolean {
  muted = !muted;
  return muted;
}

export function isMuted() {
  return muted;
}

function noiseBurst(startTime: number, filterFreq: number, vol: number, dur: number) {
  if (muted) return;
  const c = ac();
  const bufLen = Math.ceil(c.sampleRate * dur);
  const buf = c.createBuffer(1, bufLen, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;

  const src = c.createBufferSource();
  src.buffer = buf;

  const filter = c.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = filterFreq;
  filter.Q.value = 1.8;

  const gain = c.createGain();
  gain.gain.setValueAtTime(vol, startTime);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + dur);

  src.connect(filter);
  filter.connect(gain);
  gain.connect(c.destination);
  src.start(startTime);
  src.stop(startTime + dur + 0.01);
}

export function playStep() {
  if (muted) return;
  const t = ac().currentTime;
  footToggle = !footToggle;
  const side = footToggle ? 1 : -1;

  // Sharp impact crack (noise burst)
  noiseBurst(t, 420 + side * 60, 0.28, 0.055);
  // Low bass thud
  tone(footToggle ? 72 : 88, t, 0.09, 0.22, "sine");
  // Subtle high tick click
  noiseBurst(t, 2800, 0.09, 0.018);
}

export function playCorrect() {
  const t = ac().currentTime;
  // Big impact hit + bright ascending arpeggio
  tone(110, t, 0.08, 0.18, "sine");          // bass thump
  tone(523.25, t, 0.12, 0.11, "square");     // punch chord root
  tone(659.25, t + 0.06, 0.15, 0.1, "square");
  tone(783.99, t + 0.12, 0.15, 0.1, "square");
  tone(1046.5, t + 0.18, 0.22, 0.12, "square");
  tone(1318.5, t + 0.24, 0.28, 0.09, "triangle"); // high sparkle
}

export function playWrong() {
  const t = ac().currentTime;
  // Heavy impact + descending "wah" punch
  tone(90, t, 0.1, 0.2, "sine");             // bass thump
  tone(440, t, 0.12, 0.12, "sawtooth");
  tone(349.23, t + 0.1, 0.15, 0.11, "sawtooth");
  tone(261.63, t + 0.2, 0.18, 0.1, "sawtooth");
  tone(196, t + 0.3, 0.22, 0.09, "sawtooth");
}

export function playLevelComplete() {
  const t = ac().currentTime;
  const melody = [523.25, 659.25, 783.99, 659.25, 783.99, 1046.5];
  melody.forEach((f, i) => tone(f, t + i * 0.12, 0.2, 0.09));
}

export function playSnap() {
  const t = ac().currentTime;
  tone(880, t, 0.06, 0.07, "square");
  tone(1108.7, t + 0.05, 0.08, 0.06, "square");
}

export function playButton() {
  const t = ac().currentTime;
  tone(659.25, t, 0.05, 0.06, "square");
  tone(783.99, t + 0.04, 0.05, 0.045, "square");
}

// ─── Background music ─────────────────────────────────────────────────────────

interface MusicPattern {
  melody: number[];
  bass: number[];
  bpm: number;
  melodyVol?: number;
  bassVol?: number;
  melodyType?: OscillatorType;
  bassType?: OscillatorType;
}

const MUSIC_PATTERNS: MusicPattern[] = [
  {
    // Bouncy adventure (original)
    melody: [
      659.25, 659.25, 0, 523.25, 659.25, 0, 783.99, 0,
      392, 0, 523.25, 0, 392, 329.63, 440, 493.88,
    ],
    bass: [
      130.81, 0, 130.81, 0, 98.0, 0, 146.83, 0,
      98.0, 0, 82.41, 0, 110.0, 0, 123.47, 0,
    ],
    bpm: 140,
  },
  {
    // Upbeat march
    melody: [
      783.99, 0, 659.25, 0, 523.25, 587.33, 659.25, 0,
      783.99, 0, 880, 0, 783.99, 659.25, 523.25, 0,
    ],
    bass: [
      196.0, 0, 164.81, 0, 130.81, 0, 196.0, 0,
      196.0, 0, 220.0, 0, 196.0, 0, 130.81, 0,
    ],
    bpm: 155,
    melodyType: "square",
    bassType: "triangle",
  },
  {
    // Gentle explorer
    melody: [
      329.63, 0, 392, 0, 440, 493.88, 523.25, 0,
      493.88, 0, 440, 0, 392, 329.63, 293.66, 0,
    ],
    bass: [
      82.41, 0, 98.0, 0, 110.0, 0, 130.81, 0,
      110.0, 0, 98.0, 0, 82.41, 0, 73.42, 0,
    ],
    bpm: 110,
    melodyVol: 0.055,
    bassVol: 0.035,
    melodyType: "triangle",
    bassType: "sine",
  },
  {
    // Energetic sprint
    melody: [
      523.25, 587.33, 659.25, 698.46, 783.99, 0, 659.25, 0,
      523.25, 0, 659.25, 0, 783.99, 0, 1046.5, 0,
    ],
    bass: [
      130.81, 0, 164.81, 0, 196.0, 0, 164.81, 0,
      130.81, 0, 130.81, 0, 98.0, 0, 130.81, 0,
    ],
    bpm: 170,
    melodyVol: 0.06,
  },
  {
    // Mystery trail
    melody: [
      440, 0, 415.3, 0, 392, 0, 369.99, 0,
      349.23, 392, 440, 0, 493.88, 0, 440, 0,
    ],
    bass: [
      110.0, 0, 103.83, 0, 98.0, 0, 92.5, 0,
      87.31, 0, 98.0, 0, 110.0, 0, 123.47, 0,
    ],
    bpm: 120,
    melodyVol: 0.05,
    bassVol: 0.035,
    melodyType: "square",
    bassType: "triangle",
  },
  {
    // Dino stomp
    melody: [
      261.63, 0, 261.63, 329.63, 392, 0, 329.63, 0,
      261.63, 0, 220, 0, 261.63, 329.63, 392, 440,
    ],
    bass: [
      65.41, 0, 65.41, 0, 98.0, 0, 65.41, 0,
      65.41, 0, 55.0, 0, 65.41, 0, 98.0, 0,
    ],
    bpm: 130,
    melodyVol: 0.07,
    bassVol: 0.05,
    bassType: "triangle",
  },
];

let bgTimer: ReturnType<typeof setTimeout> | null = null;
let musicOn = false;
let step = 0;
let currentPattern: MusicPattern = MUSIC_PATTERNS[0];

function tick() {
  if (!musicOn) return;
  const t = ac().currentTime;
  const beat = 60 / currentPattern.bpm;
  const { melody, bass, melodyVol = 0.05, bassVol = 0.04,
          melodyType = "square", bassType = "triangle" } = currentPattern;

  if (melody[step]) tone(melody[step], t, beat * 0.7, melodyVol, melodyType);
  if (bass[step]) tone(bass[step], t, beat * 0.9, bassVol, bassType);

  step = (step + 1) % melody.length;
  bgTimer = setTimeout(tick, beat * 1000);
}

export function startMusic() {
  if (musicOn) return;
  currentPattern = MUSIC_PATTERNS[Math.floor(Math.random() * MUSIC_PATTERNS.length)];
  step = 0;
  musicOn = true;
  ac();
  tick();
}

export function shuffleMusic() {
  // Pick a different pattern from the current one
  const others = MUSIC_PATTERNS.filter((p) => p !== currentPattern);
  currentPattern = others[Math.floor(Math.random() * others.length)];
  step = 0;
}

export function stopMusic() {
  musicOn = false;
  if (bgTimer) clearTimeout(bgTimer);
  bgTimer = null;
}

export function isMusicOn() {
  return musicOn;
}
