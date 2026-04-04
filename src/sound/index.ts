let ctx: AudioContext | null = null;
let footToggle = false;
let musicMuted = import.meta.env.DEV;
const MUSIC_VOLUME_SCALE = 0.25;
const SFX_VOLUME_SCALE = 1;

function ac(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function tone(
  freq: number,
  start: number,
  dur: number,
  vol = 0.08,
  type: OscillatorType = "square",
  channel: "sfx" | "music" = "sfx",
) {
  if (channel === "music" && musicMuted) return;
  const c = ac();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.connect(gain);
  gain.connect(c.destination);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  const scaledVol = vol * (channel === "music" ? MUSIC_VOLUME_SCALE : SFX_VOLUME_SCALE);
  gain.gain.setValueAtTime(scaledVol, start);
  gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
  osc.start(start);
  osc.stop(start + dur + 0.01);
}

export function toggleMute(): boolean {
  musicMuted = !musicMuted;
  return musicMuted;
}

export function isMuted() {
  return musicMuted;
}

function noiseBurst(startTime: number, filterFreq: number, vol: number, dur: number, channel: "sfx" | "music" = "sfx") {
  if (channel === "music" && musicMuted) return;
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
  const scaledVol = vol * (channel === "music" ? MUSIC_VOLUME_SCALE : SFX_VOLUME_SCALE);
  gain.gain.setValueAtTime(scaledVol, startTime);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + dur);

  src.connect(filter);
  filter.connect(gain);
  gain.connect(c.destination);
  src.start(startTime);
  src.stop(startTime + dur + 0.01);
}

export function playStep() {
  const t = ac().currentTime;
  footToggle = !footToggle;
  const side = footToggle ? 1 : -1;

  // Sharp impact crack (noise burst)
  noiseBurst(t, 420 + side * 60, 0.36, 0.06);
  // Low bass thud
  tone(footToggle ? 72 : 88, t, 0.1, 0.3, "sine");
  // Subtle high tick click
  noiseBurst(t, 2800, 0.14, 0.022);
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

export function playKeyClick() {
  const t = ac().currentTime;
  noiseBurst(t, 2600, 0.14, 0.02);
  tone(1900, t, 0.026, 0.08, "square");
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

  if (melody[step]) tone(melody[step], t, beat * 0.7, melodyVol, melodyType, "music");
  if (bass[step]) tone(bass[step], t, beat * 0.9, bassVol, bassType, "music");

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

// ─── Monster Round music & SFX ────────────────────────────────────────────────

const MONSTER_MUSIC_PATTERNS: MusicPattern[] = [
  {
    // Boss battle — heavy, minor key
    melody: [
      220, 0, 220, 246.94, 220, 0, 196, 0,
      196, 0, 174.61, 0, 196, 0, 220, 0,
    ],
    bass: [
      55, 0, 55, 0, 73.42, 0, 55, 0,
      49, 0, 43.65, 0, 49, 0, 55, 0,
    ],
    bpm: 160,
    melodyVol: 0.08,
    bassVol: 0.065,
    melodyType: "sawtooth",
    bassType: "square",
  },
  {
    // Ominous creep
    melody: [
      146.83, 0, 164.81, 155.56, 146.83, 0, 130.81, 0,
      123.47, 0, 130.81, 0, 146.83, 164.81, 0, 0,
    ],
    bass: [
      73.42, 0, 0, 0, 73.42, 0, 61.74, 0,
      61.74, 0, 65.41, 0, 73.42, 0, 0, 0,
    ],
    bpm: 125,
    melodyVol: 0.07,
    bassVol: 0.08,
    melodyType: "square",
    bassType: "sawtooth",
  },
  {
    // Jurassic rampage
    melody: [
      329.63, 0, 349.23, 0, 329.63, 293.66, 261.63, 0,
      261.63, 293.66, 329.63, 0, 349.23, 329.63, 293.66, 0,
    ],
    bass: [
      82.41, 0, 82.41, 0, 73.42, 0, 65.41, 0,
      65.41, 0, 73.42, 0, 82.41, 0, 87.31, 0,
    ],
    bpm: 155,
    melodyVol: 0.075,
    bassVol: 0.06,
    melodyType: "sawtooth",
    bassType: "triangle",
  },
];

export function switchToMonsterMusic() {
  currentPattern = MONSTER_MUSIC_PATTERNS[Math.floor(Math.random() * MONSTER_MUSIC_PATTERNS.length)];
  step = 0;
}

/** Dramatic sting played when Monster Round begins. */
export function playMonsterStart() {
  const t = ac().currentTime;
  tone(55,      t,       0.18, 0.28, "sawtooth");
  tone(110,     t + 0.06, 0.15, 0.22, "sawtooth");
  tone(392,     t + 0.18, 0.14, 0.14, "square");
  tone(349.23,  t + 0.34, 0.14, 0.13, "square");
  tone(329.63,  t + 0.50, 0.14, 0.13, "square");
  tone(261.63,  t + 0.66, 0.38, 0.17, "sawtooth");
  noiseBurst(t + 0.66, 200, 0.15, 0.32);
}

/** Grand finale played when all 3 levels are completed. */
export function playGameComplete() {
  const t = ac().currentTime;

  // Extended clap sequence
  [0, 0.18, 0.36, 0.54, 0.72, 0.90].forEach((dt) => {
    noiseBurst(t + dt, 1200, 0.4,  0.07);
    noiseBurst(t + dt, 3500, 0.22, 0.05);
  });

  // Grand two-octave rising fanfare
  const notes: [number, number][] = [
    [1.1,  523.25], [1.28, 659.25], [1.46, 783.99], [1.64, 1046.5],
    [1.82, 1318.5], [2.0,  1567.98], [2.18, 2093],
    [2.4,  1760],   [2.55, 2093],   [2.7,  2349.32], [2.85, 2637.02],
  ];
  notes.forEach(([dt, freq]) => {
    tone(freq,     t + dt, 0.3,  0.12, "square");
    tone(freq / 2, t + dt, 0.3,  0.07, "triangle");
  });

  // Big clap burst at peak
  noiseBurst(t + 2.85, 1200, 0.5,  0.1);
  noiseBurst(t + 2.97, 3500, 0.28, 0.07);

  // Sustaining final chord
  [1046.5, 1318.5, 1567.98, 2093].forEach((freq, i) => {
    tone(freq, t + 3.1 + i * 0.06, 1.5, 0.09, "triangle");
  });
}

/** Full celebration fanfare played when the Monster Round is beaten. */
export function playMonsterVictory() {
  const t = ac().currentTime;

  // Clap rhythm — 4 sharp noise bursts
  const clapTimes = [0, 0.22, 0.44, 0.58];
  clapTimes.forEach((dt) => {
    noiseBurst(t + dt, 1200, 0.35, 0.07);
    noiseBurst(t + dt, 3500, 0.18, 0.05);
  });

  // Short triumphant fanfare after the claps
  const fanfare: [number, number][] = [
    [0.75,  523.25],
    [0.9,   659.25],
    [1.05,  783.99],
    [1.2,   1046.5],
    [1.35,  880],
    [1.5,   1046.5],
    [1.65,  1318.5],
    [1.8,   1567.98],
  ];
  fanfare.forEach(([dt, freq]) => {
    tone(freq, t + dt, 0.22, 0.11, "square");
    tone(freq / 2, t + dt, 0.22, 0.06, "triangle");
  });

  // Second clap burst at the peak
  noiseBurst(t + 1.8, 1200, 0.4, 0.08);
  noiseBurst(t + 1.9, 3500, 0.22, 0.06);

  // Final resolving chord
  tone(1046.5, t + 2.1, 0.5, 0.10, "triangle");
  tone(1318.5, t + 2.1, 0.5, 0.08, "triangle");
  tone(1567.98, t + 2.1, 0.5, 0.07, "triangle");
}

/** Sparkly golden sound when a white egg turns golden in Monster Round. */
export function playGoldenEgg() {
  const t = ac().currentTime;
  tone(880,    t,        0.08, 0.10, "square");
  tone(1108.7, t + 0.07, 0.10, 0.10, "square");
  tone(1318.5, t + 0.14, 0.12, 0.12, "triangle");
  tone(1760,   t + 0.21, 0.18, 0.10, "triangle");
  tone(2093,   t + 0.28, 0.22, 0.09, "triangle");
  noiseBurst(t + 0.33, 3500, 0.07, 0.18);
}
