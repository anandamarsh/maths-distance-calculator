let ctx: AudioContext | null = null;
let footToggle = false;

function ac(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function tone(freq: number, start: number, dur: number, vol = 0.08, type: OscillatorType = "square") {
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

export function playStep() {
  const t = ac().currentTime;
  footToggle = !footToggle;
  tone(footToggle ? 180 : 220, t, 0.045, 0.045, "square");
  tone(footToggle ? 110 : 135, t + 0.015, 0.035, 0.02, "triangle");
}

export function playCorrect() {
  const t = ac().currentTime;
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, t + i * 0.1, 0.18, 0.08));
}

export function playWrong() {
  const t = ac().currentTime;
  tone(220, t, 0.15, 0.1, "sawtooth");
  tone(180, t + 0.1, 0.2, 0.08, "sawtooth");
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

// Background music
let bgTimer: ReturnType<typeof setTimeout> | null = null;
let musicOn = false;

const MELODY = [
  659.25, 659.25, 0, 523.25, 659.25, 0, 783.99, 0,
  392, 0, 523.25, 0, 392, 329.63, 440, 493.88,
];
const BASS = [
  130.81, 0, 130.81, 0, 98.0, 0, 146.83, 0,
  98.0, 0, 82.41, 0, 110.0, 0, 123.47, 0,
];
let step = 0;
const BPM = 140;
const BEAT = 60 / BPM;

function tick() {
  if (!musicOn) return;
  const t = ac().currentTime;
  if (MELODY[step]) tone(MELODY[step], t, BEAT * 0.7, 0.05, "square");
  if (BASS[step]) tone(BASS[step], t, BEAT * 0.9, 0.04, "triangle");
  step = (step + 1) % MELODY.length;
  bgTimer = setTimeout(tick, BEAT * 1000);
}

export function startMusic() {
  if (musicOn) return;
  musicOn = true;
  ac();
  tick();
}

export function stopMusic() {
  musicOn = false;
  if (bgTimer) clearTimeout(bgTimer);
  bgTimer = null;
}

export function isMusicOn() {
  return musicOn;
}
