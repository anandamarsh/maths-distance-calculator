import { useCallback, useEffect, useRef, useState } from "react";
import {
  makeOneQuestion,
  generateTrailConfig,
  type TrailConfig,
  type TrailQuestion,
} from "../game/levelOne";
import { randomDino, type DinoSprite } from "../game/dinos";
import { playButton, playCorrect, playStep, playWrong, startMusic, shuffleMusic, switchToMonsterMusic, toggleMute, isMuted, playMonsterStart, playGoldenEgg, playMonsterVictory, playGameComplete } from "../sound";

// ─── SVG coordinate helper ───────────────────────────────────────────────────

function toSVGPoint(svg: SVGSVGElement, clientX: number, clientY: number) {
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const pt = svg.createSVGPoint();
  pt.x = clientX; pt.y = clientY;
  const r = pt.matrixTransform(ctm.inverse());
  return { x: r.x, y: r.y };
}

// ─── Trail geometry ───────────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function totalKm(config: TrailConfig) {
  return Number(config.edges.reduce((s, e) => s + e.distance, 0).toFixed(3));
}

function getCheckpoints(config: TrailConfig): number[] {
  let km = 0;
  const pts = [0];
  for (const e of config.edges) {
    km += e.distance;
    pts.push(Number(km.toFixed(3)));
  }
  return pts;
}

function posAtKm(config: TrailConfig, km: number, checkpoints: number[]) {
  const clamped = clamp(km, 0, checkpoints[checkpoints.length - 1]);
  for (let i = 0; i < config.edges.length; i++) {
    const start = checkpoints[i];
    const end = checkpoints[i + 1];
    if (clamped <= end + 0.0001 || i === config.edges.length - 1) {
      const t = clamp((clamped - start) / (config.edges[i].distance || 1), 0, 1);
      const A = config.stops[i], B = config.stops[i + 1];
      return { x: A.x + (B.x - A.x) * t, y: A.y + (B.y - A.y) * t };
    }
  }
  const last = config.stops[config.stops.length - 1];
  return { x: last.x, y: last.y };
}

function projectToTrail(config: TrailConfig, svgX: number, svgY: number, checkpoints: number[]) {
  let bestKm = 0;
  let bestDist = Infinity;
  for (let i = 0; i < config.edges.length; i++) {
    const A = config.stops[i], B = config.stops[i + 1];
    const dx = B.x - A.x, dy = B.y - A.y;
    const lenSq = dx * dx + dy * dy || 1;
    const t = clamp(((svgX - A.x) * dx + (svgY - A.y) * dy) / lenSq, 0, 1);
    const px = A.x + dx * t, py = A.y + dy * t;
    const d = Math.hypot(svgX - px, svgY - py);
    if (d < bestDist) {
      bestDist = d;
      bestKm = checkpoints[i] + config.edges[i].distance * t;
    }
  }
  return bestKm;
}

const IS_DEV = import.meta.env.DEV;

// ─── Question generator dispatcher ───────────────────────────────────────────

function createRun(level: number) {
  const config = generateTrailConfig(level);
  const dino = randomDino();
  const dinoColor = DINO_COLORS[Math.floor(Math.random() * DINO_COLORS.length)];
  const firstQ = makeOneQuestion(config, level, dino.nickname);
  return { config, firstQ, dino, dinoColor };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

// Dino colours — one per sprite slot, cycles with palette
const DINO_COLORS = ["#22c55e", "#34d399", "#4ade80", "#86efac", "#a3e635", "#facc15"];

const MONSTER_ROUND_NAMES = [
  "MONSTER ROUND",
  "TITAN CHALLENGE",
  "DINO STORM",
  "EXTINCTION EVENT",
  "JURASSIC GAUNTLET",
  "THUNDER ROUND",
];

// Background per level × phase
const PHASE_BG: Record<string, { bg: string; glow: string; tint: string }> = {
  "1-normal":  { bg: "#080e1c", glow: "#1e3a5f", tint: "transparent" },
  "1-monster": { bg: "#0f0520", glow: "#5b21b6", tint: "rgba(109,40,217,0.08)" },
  "2-normal":  { bg: "#071510", glow: "#14532d", tint: "transparent" },
  "2-monster": { bg: "#180a00", glow: "#92400e", tint: "rgba(234,88,12,0.1)" },
  "3-normal":  { bg: "#07161a", glow: "#134e4a", tint: "transparent" },
  "3-monster": { bg: "#1a0508", glow: "#7f1d1d", tint: "rgba(220,38,38,0.1)" },
};

/** Renders text with numbers highlighted in a distinct accent colour. */
function ColoredPrompt({ text, className = "" }: { text: string; className?: string }) {
  const parts = text.split(/(\d+\.?\d*)/g);
  return (
    <span className={className}>
      {parts.map((p, i) =>
        /^\d+\.?\d*$/.test(p)
          ? <span key={i} className="text-yellow-300 font-black">{p}</span>
          : p
      )}
    </span>
  );
}

function RexSprite({ dino, dinoColor, walking, facingLeft }: {
  dino: DinoSprite;
  dinoColor: string;
  walking: boolean;
  facingLeft: boolean;
}) {
  return (
    <g style={{ transform: facingLeft ? "scaleX(-1)" : undefined }}>
      <g className={walking ? "dino-walk" : ""}>
        {/* ground shadow */}
        <ellipse cx={0} cy={6} rx={36} ry={9} fill="rgba(0,0,0,0.32)" />
        {/* icon centred at (0,0), scaled to ~100px, sitting just above y=0 */}
        <svg x={-50} y={-100} width={100} height={100} viewBox="0 0 512 512" overflow="visible">
          <path d={dino.path} fill={dinoColor} />
        </svg>
      </g>
    </g>
  );
}

function StopMarker({
  stop, active, isFirst, isLast, palette,
}: {
  stop: TrailConfig["stops"][0];
  active: boolean;
  isFirst: boolean;
  isLast: boolean;
  palette: TrailConfig["palette"];
}) {
  const r = active ? 30 : 24;
  return (
    <g>
      {active && <circle cx={stop.x} cy={stop.y} r={r + 14} fill={palette.accent} opacity={0.16} />}
      <ellipse cx={stop.x + 3} cy={stop.y + r + 4} rx={r * 0.6} ry={r * 0.2} fill="rgba(0,0,0,0.35)" />
      <circle cx={stop.x} cy={stop.y} r={r}
        fill={active ? palette.node : "#1e293b"}
        stroke={active ? palette.accent : "#475569"}
        strokeWidth={active ? 5 : 3}
      />
      <text x={stop.x} y={stop.y + 8} textAnchor="middle" fontSize={r * 0.72} fontWeight="900" fill="white">
        {isFirst ? "S" : isLast ? "F" : "●"}
      </text>
      <text x={stop.x} y={stop.y + r + 22} textAnchor="middle" fontSize="21" fontWeight="800"
        fill={palette.text} stroke="rgba(0,0,0,0.8)" strokeWidth={3} paintOrder="stroke">
        {stop.label}
      </text>
    </g>
  );
}

function NumericKeypad({
  value,
  onChange,
  onSubmit,
  canSubmit,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  canSubmit: boolean;
}) {
  function press(key: string) {
    if (key === "⌫") {
      onChange(value.slice(0, -1));
      return;
    }
    if (key === "±") {
      if (value.startsWith("-")) onChange(value.slice(1));
      else if (value !== "" && value !== "0") onChange("-" + value);
      return;
    }
    if (key === ".") {
      if (!value.includes(".")) onChange(value === "" ? "0." : `${value}.`);
      return;
    }
    onChange(value === "0" ? key : `${value}${key}`);
  }

  const display = value === "" ? "0" : value;
  const rows = [
    ["7", "8", "9", "⌫"],
    ["4", "5", "6", "±"],
    ["1", "2", "3", "."],
  ];
  const base = "rounded flex items-center justify-center font-black select-none transition-transform active:scale-95 text-base md:text-sm h-11 md:h-8";
  const digit = `${base} bg-slate-800 text-slate-100 border border-slate-600/60`;
  const op = `${base} bg-slate-700/80 text-cyan-300 border border-slate-500/60`;

  return (
    <div
      className="flex flex-col gap-1 rounded-xl p-1.5 shrink-0 w-40 md:w-44"
      style={{
        background: "rgba(2,6,23,0.97)",
        border: "2px solid rgba(56,189,248,0.45)",
        boxShadow: "0 0 18px rgba(56,189,248,0.12), inset 0 0 12px rgba(0,0,0,0.4)",
      }}
    >
      <div
        className="rounded-lg px-2 h-10 md:h-8 flex items-center justify-end overflow-hidden"
        style={{
          fontFamily: "'DSEG7Classic', 'Courier New', monospace",
          fontWeight: 700,
          fontSize: "1.05rem",
          background: "rgba(0,8,4,0.95)",
          border: "2px solid rgba(56,189,248,0.28)",
          color: "#67e8f9",
          textShadow: "0 0 10px rgba(103,232,249,0.85), 0 0 22px rgba(56,189,248,0.4)",
          letterSpacing: "0.12em",
        }}
      >
        {display}
      </div>
      <div className="flex flex-col gap-0.5">
        {rows.map((row, r) => (
          <div key={r} className="grid grid-cols-4 gap-0.5">
            {row.map((btn) => (
              <button key={btn} type="button" onClick={() => press(btn)} className={/[0-9]/.test(btn) ? digit : op}>
                {btn}
              </button>
            ))}
          </div>
        ))}
        <div className="flex gap-0.5 mt-0.5">
          <button type="button" onClick={() => press("0")} className={`${digit} flex-[2]`}>0</button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={!canSubmit}
            className={`${base} flex-[2] arcade-button disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 13 L9 18 L20 7" stroke="white" strokeWidth="3" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ArcadeLevelOneScreen() {
  const [level, setLevel] = useState<1 | 2 | 3>(1);
  const [unlockedLevel, setUnlockedLevel] = useState<1 | 2 | 3>(1);
  const [run, setRun] = useState(() => createRun(1));
  const [screen, setScreen] = useState<"playing" | "won" | "gameover">("playing");
  const [currentQ, setCurrentQ] = useState<TrailQuestion>(() => run.firstQ);
  const [eggsCollected, setEggsCollected] = useState(0);
  const [answer, setAnswer] = useState("");
  const [subAnswers, setSubAnswers] = useState<[string, string, string]>(["", "", ""]);
  const [subStep, setSubStep] = useState(0); // Level 3: which step (0/1/2) is active
  const [posKm, setPosKm] = useState(0);
  const [minKm, setMinKm] = useState(0);
  const [maxKm, setMaxKm] = useState(0);
  const [odomKm, setOdomKm] = useState(0);
  const [walking, setWalking] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [facingLeft, setFacingLeft] = useState(false);
  const [soundMuted, setSoundMuted] = useState(false);
  const [topPanel, setTopPanel] = useState<"map" | "question">("map");
  const [flash, setFlash] = useState<{ text: string; ok: boolean; icon?: boolean } | null>(null);
  const [gamePhase, setGamePhase] = useState<"normal" | "monster">("normal");
  const [monsterEggs, setMonsterEggs] = useState(0);
  const [monsterRoundName, setMonsterRoundName] = useState("");
  const [showMonsterAnnounce, setShowMonsterAnnounce] = useState(false);

  const svgRef = useRef<SVGSVGElement>(null);
  const draggingRef = useRef(false);
  const walkTimerRef = useRef<number | null>(null);
  const flashTimerRef = useRef<number | null>(null);
  const posKmRef = useRef(0);
  const minKmRef = useRef(0);
  const maxKmRef = useRef(0);
  const odometerRef = useRef(0);
  const lastStepRef = useRef(0);
  const gamePhaseRef = useRef<"normal" | "monster">("normal");
  const keypadValueRef = useRef("");
  const handleKeypadChangeRef = useRef((_v: string) => {});
  const submitAnswerRef = useRef(() => {});

  const { config, dino, dinoColor } = run;
  const checkpoints = getCheckpoints(config);

  // Stable refs so the window pointer-listener closure never goes stale.
  // Initialised with the current values; kept in sync every render below.
  const configRef = useRef(config);
  const checkpointsRef = useRef(checkpoints);
  // moveRex ref — filled in after moveRex is defined below
  const moveRexRef = useRef<(km: number) => void>(() => {});

  // Keep stable refs in sync with every render so window listeners stay current.
  configRef.current = config;
  checkpointsRef.current = checkpoints;
  const token = posAtKm(config, posKm, checkpoints);
  const routeStops = new Set(currentQ.route.map((i) => config.stops[i].id));

  // Tight viewBox so the trail fills the full map area on every screen ratio
  const xs = config.stops.map((s) => s.x);
  const ys = config.stops.map((s) => s.y);
  const padTop = 115;   // room for dino sprite above node
  const padBottom = 60; // room for stop labels below node
  const padSide = 80;   // room for label text either side
  const vbX = Math.min(...xs) - padSide;
  const vbY = Math.min(...ys) - padTop;
  const vbW = Math.max(...xs) - Math.min(...xs) + padSide * 2;
  const vbH = Math.max(...ys) - Math.min(...ys) + padTop + padBottom;
  const tightViewBox = `${vbX} ${vbY} ${vbW} ${vbH}`;

  useEffect(() => {
    startMusic();
    setSoundMuted(isMuted());
    // Teleport dino to the first question's start stop on initial load
    const firstStartKm = getCheckpoints(run.config)[run.firstQ.route[0]];
    posKmRef.current = firstStartKm;
    minKmRef.current = firstStartKm;
    maxKmRef.current = firstStartKm;
    lastStepRef.current = firstStartKm;
    setPosKm(firstStartKm);
    setMinKm(firstStartKm);
    setMaxKm(firstStartKm);
  }, []);

  useEffect(() => {
    if (!window.matchMedia("(pointer: fine)").matches) return;

    function onKeyDown(e: KeyboardEvent) {
      const tag = (document.activeElement as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      const k = e.key;
      if (k === "Enter") {
        e.preventDefault();
        submitAnswerRef.current();
        return;
      }

      if (!/^[0-9]$/.test(k) && k !== "Backspace" && k !== "." && k !== "-") return;
      e.preventDefault();

      const val = keypadValueRef.current;
      let next = val;
      if (k === "Backspace") {
        next = val.slice(0, -1);
      } else if (k === "-") {
        if (val.startsWith("-")) next = val.slice(1);
        else if (val !== "" && val !== "0") next = `-${val}`;
        else return;
      } else if (k === ".") {
        if (val.includes(".")) return;
        next = val === "" ? "0." : `${val}.`;
      } else {
        next = val === "0" ? k : `${val}${k}`;
      }
      handleKeypadChangeRef.current(next);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // ── Reliable native pointer drag listeners (bypasses React synthetic event quirks) ──
  // Runs once; uses refs so the closure is always reading the latest values.
  useEffect(() => {
    function onPointerMove(e: PointerEvent) {
      if (!draggingRef.current || !svgRef.current) return;
      const { x, y } = toSVGPoint(svgRef.current, e.clientX, e.clientY);
      moveRexRef.current(projectToTrail(configRef.current, x, y, checkpointsRef.current));
    }
    function onPointerUp() {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      setDragging(false);
    }
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, []); // Empty deps — refs keep values current without re-registering

  const moveRex = useCallback((nextKm: number) => {
    const { edges } = run.config;
    const cp = getCheckpoints(run.config);
    let clamped = clamp(nextKm, 0, totalKm(run.config));

    // Snap to nearest node km to kill odometer jitter.
    // Each node's snap zone = 15% of its shorter adjacent edge, so zones
    // can never overlap even on the shortest edge (15%+15% = 30% < 100%).
    for (let ci = 0; ci < cp.length; ci++) {
      const edgeBefore = ci > 0               ? edges[ci - 1].distance : Infinity;
      const edgeAfter  = ci < edges.length    ? edges[ci].distance     : Infinity;
      const snapKm     = Math.min(edgeBefore, edgeAfter) * 0.15;
      if (Math.abs(clamped - cp[ci]) <= snapKm) {
        clamped = cp[ci];
        break;
      }
    }

    const prev = posKmRef.current;
    const delta = Math.abs(clamped - prev);
    if (delta < 0.001) return;

    posKmRef.current = clamped;
    setPosKm(clamped);

    // Track the full visited range [minKm, maxKm] so both forward AND backward
    // movement gets colored correctly.
    const newMax = Math.max(maxKmRef.current, clamped);
    if (newMax !== maxKmRef.current) {
      maxKmRef.current = newMax;
      setMaxKm(newMax);
    }
    const newMin = Math.min(minKmRef.current, clamped);
    if (newMin !== minKmRef.current) {
      minKmRef.current = newMin;
      setMinKm(newMin);
    }

    setFacingLeft(clamped < prev);

    // Always track total distance for footstep cadence.
    // Only update the displayed odometer in normal phase (monster round disables it).
    odometerRef.current += delta;
    if (gamePhaseRef.current === "normal") {
      setOdomKm(odometerRef.current);
    }

    if (odometerRef.current - lastStepRef.current >= 0.35) {
      playStep();
      lastStepRef.current = odometerRef.current;
    }
    setWalking(true);
    if (walkTimerRef.current) clearTimeout(walkTimerRef.current);
    walkTimerRef.current = window.setTimeout(() => setWalking(false), 150);
  }, [run.config]);

  // Keep moveRexRef pointing at the latest moveRex (stable within a run).
  moveRexRef.current = moveRex;
  // Keep gamePhaseRef in sync so the window pointer listener always sees current phase.
  gamePhaseRef.current = gamePhase;

  function startDrag(e: React.PointerEvent) {
    e.preventDefault();
    // Capture pointer on the SVG so pointermove events keep firing even when
    // the finger drifts off the dino — window listener above handles the moves.
    svgRef.current?.setPointerCapture(e.pointerId);
    draggingRef.current = true;
    setDragging(true);
    // Kick off position update immediately on first touch/click.
    if (svgRef.current) {
      const { x, y } = toSVGPoint(svgRef.current, e.clientX, e.clientY);
      moveRexRef.current(projectToTrail(configRef.current, x, y, checkpointsRef.current));
    }
  }

  function resetPosition(startKm = 0) {
    posKmRef.current = startKm;
    minKmRef.current = startKm;
    maxKmRef.current = startKm;
    odometerRef.current = 0;
    lastStepRef.current = startKm;
    setPosKm(startKm);
    setMinKm(startKm);
    setMaxKm(startKm);
    setOdomKm(0);
    setWalking(false);
    setAnswer("");
    setSubAnswers(["", "", ""]);
    setSubStep(0);
  }

  function resetOdometer() {
    playButton();
    odometerRef.current = 0;
    lastStepRef.current = posKmRef.current;
    setOdomKm(0);
  }

  function handleToggleMute() {
    const nowMuted = toggleMute();
    setSoundMuted(nowMuted);
  }

  function resetCurrentQuestion() {
    playButton();
    setFlash(null);
    setDragging(false);
    setFacingLeft(false);
    const startKm = getCheckpoints(config)[currentQ.route[0]];
    resetPosition(startKm);
  }

  function beginNewRun(targetLevel?: 1 | 2 | 3) {
    playButton();
    shuffleMusic();
    const lv = targetLevel ?? level;
    const next = createRun(lv);
    if (targetLevel) setLevel(targetLevel);
    setRun(next);
    setScreen("playing");
    setCurrentQ(next.firstQ);
    setEggsCollected(0);
    setMonsterEggs(0);
    setGamePhase("normal");
    setFlash(null);
    setDragging(false);
    setFacingLeft(false);
    const firstStartKm = getCheckpoints(next.config)[next.firstQ.route[0]];
    resetPosition(firstStartKm);
  }

  /** DEV ONLY: jump straight to having i+1 eggs on the current level/phase. */
  function devSetEggs(i: number) {
    if (!IS_DEV) return;
    const target = i + 1;
    if (gamePhase === "monster") {
      if (target === 5) { earnMonsterEgg(); }
      else { setMonsterEggs(target); }
      return;
    }
    if (target === 5) {
      setEggsCollected(5);
      startMonsterRound();
    } else {
      setEggsCollected(target);
      const next = createRun(level);
      setRun(next);
      setCurrentQ(next.firstQ);
      resetPosition(getCheckpoints(next.config)[next.firstQ.route[0]]);
    }
  }

  function startMonsterRound() {
    const name = MONSTER_ROUND_NAMES[Math.floor(Math.random() * MONSTER_ROUND_NAMES.length)];
    setMonsterRoundName(name);
    setGamePhase("monster");
    setMonsterEggs(0);
    setShowMonsterAnnounce(true);
    playMonsterStart();
    switchToMonsterMusic();
    // Fresh run so the child gets a new map to think through without the odometer
    const next = createRun(level);
    setRun(next);
    setCurrentQ(next.firstQ);
    setSubAnswers(["", "", ""]);
    setSubStep(0);
    const startKm = getCheckpoints(next.config)[next.firstQ.route[0]];
    resetPosition(startKm);
    window.setTimeout(() => setShowMonsterAnnounce(false), 2800);
  }

  function earnMonsterEgg() {
    const newGolden = monsterEggs + 1;
    if (newGolden === 5) {
      setMonsterEggs(5);
      if (level === 3) {
        // All levels complete — grand finale
        playGameComplete();
        setScreen("gameover");
      } else {
        playMonsterVictory();
        if (!IS_DEV) setUnlockedLevel((u) => Math.max(u, level + 1) as 1 | 2 | 3);
        // gamePhase stays "monster" so won screen shows the right message
        setScreen("won");
      }
      return;
    }
    setMonsterEggs(newGolden);
    playGoldenEgg();
    setFlash({ text: "", ok: true, icon: true });
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = window.setTimeout(() => setFlash(null), 1100);
    const next = createRun(level);
    setRun(next);
    setCurrentQ(next.firstQ);
    resetPosition(getCheckpoints(next.config)[next.firstQ.route[0]]);
  }

  function showFlash(text: string, ok: boolean) {
    setFlash({ text, ok });
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = window.setTimeout(() => setFlash(null), 1600);
  }

  function earnEgg() {
    const newEggs = eggsCollected + 1;
    if (newEggs === 5) {
      setEggsCollected(5);
      // Trigger Monster Round instead of going straight to the won screen
      startMonsterRound();
      return;
    }
    setEggsCollected(newEggs);
    setFlash({ text: "", ok: true, icon: true });
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = window.setTimeout(() => setFlash(null), 1100);
    const next = createRun(level);
    setRun(next);
    setCurrentQ(next.firstQ);
    resetPosition(getCheckpoints(next.config)[next.firstQ.route[0]]);
  }

  function loseEgg() {
    playWrong();
    if (gamePhase === "monster") {
      setMonsterEggs((e) => Math.max(0, e - 1));
    } else {
      setEggsCollected((e) => Math.max(0, e - 1));
    }
    setFlash({ text: "", ok: false, icon: true });
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = window.setTimeout(() => setFlash(null), 1100);
    const nextQ = makeOneQuestion(config, level, dino.nickname);
    setCurrentQ(nextQ);
    resetPosition(getCheckpoints(config)[nextQ.route[0]]);
  }

  function submitAnswer() {
    playButton();

    // ── Level 3: stepped one-at-a-time ──
    if (currentQ.subAnswers && currentQ.promptLines) {
      const g = parseFloat(subAnswers[subStep]);
      if (isNaN(g)) { showFlash("Enter a number!", false); return; }
      const ok = Math.abs(g - currentQ.subAnswers[subStep]) < 0.11;

      if (subStep < 2) {
        if (ok) {
          // Intermediate correct: advance to next step, no egg change
          setSubStep((s) => s + 1);
        } else {
          // Intermediate wrong: flash only, no egg loss, stay on same step
          playWrong();
          showFlash("Try again!", false);
          setSubAnswers((prev) => {
            const next = [...prev] as [string, string, string];
            next[subStep] = "";
            return next;
          });
        }
        return;
      }

      // Final step (step 2)
      if (ok) { playCorrect(); gamePhase === "monster" ? earnMonsterEgg() : earnEgg(); } else { loseEgg(); }
      return;
    }

    // ── Level 1 / 2 ──
    const guess = parseFloat(answer);
    if (isNaN(guess)) { showFlash("Type a number!", false); return; }
    const correct = Math.abs(guess - currentQ.answer) < 0.11;
    if (correct) { playCorrect(); gamePhase === "monster" ? earnMonsterEgg() : earnEgg(); } else { loseEgg(); }
  }

  function handleKeypadChange(v: string) {
    if (currentQ.subAnswers && currentQ.promptLines) {
      setSubAnswers((prev) => {
        const next = [...prev] as [string, string, string];
        next[subStep] = v;
        return next;
      });
      return;
    }

    setAnswer(v);
  }

  const pal = config.palette;
  const phaseBg = PHASE_BG[`${level}-${gamePhase}`] ?? { bg: pal.bg, glow: pal.bgGlow, tint: "transparent" };
  const keypadValue = currentQ.promptLines ? subAnswers[subStep] : answer;
  const canKeypadSubmit = currentQ.promptLines
    ? !isNaN(parseFloat(subAnswers[subStep]))
    : !isNaN(parseFloat(answer));
  keypadValueRef.current = keypadValue;
  handleKeypadChangeRef.current = handleKeypadChange;
  submitAnswerRef.current = submitAnswer;

  return (
    <div
      className="relative h-svh w-screen overflow-hidden font-arcade"
      style={{ background: `radial-gradient(ellipse at top, ${phaseBg.glow} 0%, ${phaseBg.bg} 72%)` }}
    >
      <div className="pointer-events-none absolute inset-0 arcade-grid opacity-20" />
      {/* Monster Round atmospheric tint overlay */}
      {gamePhase === "monster" && (
        <div className="pointer-events-none absolute inset-0 z-[1]"
          style={{ background: phaseBg.tint }} />
      )}

      {/* ── top bar ── */}
      <div className="absolute left-0 right-0 top-0 z-20 flex items-start px-3 pt-2 md:px-5 md:pt-2">

        {/* Left icon buttons — match shell home: w-10 h-10, arcade-button, p-2, SVG w-full h-full
            Mobile: flex-col below shell home; Desktop: flex-row, tight gap after 40px home */}
        <div className="flex flex-col md:flex-row gap-1 mt-[76px] md:mt-0 md:ml-[42px] shrink-0">
          <button
            onClick={resetCurrentQuestion}
            title="Reset"
            className="arcade-button w-10 h-10 flex items-center justify-center p-2"
          >
            <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
              <path d="M1 4v6h6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M23 20v-6h-6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <button
            onClick={handleToggleMute}
            title={soundMuted ? "Unmute" : "Mute"}
            className="arcade-button w-10 h-10 flex items-center justify-center p-2"
            style={soundMuted ? { background: "linear-gradient(180deg,#475569,#334155)", boxShadow: "0 5px 0 #1e293b", borderColor: "#94a3b8" } : {}}
          >
            <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
              {soundMuted ? (
                <>
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="white"/>
                  <line x1="23" y1="9" x2="17" y2="15" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                  <line x1="17" y1="9" x2="23" y2="15" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                </>
              ) : (
                <>
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="white"/>
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                </>
              )}
            </svg>
          </button>
        </div>

        {/* Center: levels + progress bar + mobile-only odometer */}
        <div className="flex-1 flex flex-col items-center gap-1.5 pt-1">
          <div className="flex items-center gap-1.5">
            {([1, 2, 3] as const).map((lv) => {
              // Lit up if: dev mode, already playing this level or lower, or unlocked via progression
              const locked = !IS_DEV && lv > unlockedLevel && lv > level;
              return (
                <button
                  key={lv}
                  onClick={() => !locked && beginNewRun(lv)}
                  disabled={locked}
                  title={locked ? `Complete Level ${lv - 1} first` : undefined}
                  className="w-9 h-8 rounded text-xs font-black border-2 transition-colors"
                  style={{
                    background: locked ? "#0f172a"
                      : level === lv ? (gamePhase === "monster" ? "#92400e" : "#0ea5e9")
                      : lv < level  ? "#78350f"   // completed — dark gold
                      : "#1e293b",
                    borderColor: locked ? "#1e293b"
                      : level === lv ? (gamePhase === "monster" ? "#fbbf24" : "#38bdf8")
                      : lv < level  ? "#fbbf24"   // completed — gold border
                      : "#475569",
                    color: locked ? "#334155"
                      : level === lv ? (gamePhase === "monster" ? "#fde047" : "white")
                      : lv < level  ? "#fde047"   // completed — gold text
                      : "#64748b",
                    boxShadow: lv < level ? "0 0 8px rgba(251,191,36,0.45)" : undefined,
                    cursor: locked ? "not-allowed" : "pointer",
                    opacity: locked ? 0.5 : 1,
                  }}
                >
                  {locked ? "🔒" : lv}
                </button>
              );
            })}
          </div>

          {/* Monster Round badge */}
          {gamePhase === "monster" && (
            <div className="text-sm font-black uppercase tracking-widest px-3 py-1 rounded-full"
              style={{
                background: "linear-gradient(135deg, rgba(161,122,6,0.85) 0%, rgba(202,138,4,0.9) 50%, rgba(161,122,6,0.85) 100%)",
                color: "#fef08a",
                border: "2px solid #fbbf24",
                boxShadow: "0 0 12px rgba(251,191,36,0.6), 0 0 28px rgba(234,179,8,0.35), inset 0 1px 0 rgba(255,255,255,0.15)",
                textShadow: "0 0 10px rgba(250,204,21,0.9)",
                animation: "pulse 2s cubic-bezier(0.4,0,0.6,1) infinite",
              }}>
              ⚡ {monsterRoundName} ⚡
            </div>
          )}

          {/* 5-egg collector — sbed / game-icons.net / CC BY 3.0 */}
          <div className="flex items-center gap-1.5"
            title={gamePhase === "monster" ? `${monsterEggs}/5 golden eggs` : `${eggsCollected}/5 eggs`}>
            {[0, 1, 2, 3, 4].map((i) => {
              const isMonster = gamePhase === "monster";
              const collected = isMonster ? i < monsterEggs : i < eggsCollected;
              // Monster: all eggs are white by default; collected ones turn golden.
              // Normal: collected = white filled, uncollected = faint outline.
              const eggFill   = isMonster
                ? (collected ? "#facc15" : "white")
                : (collected ? "white"   : "transparent");
              const eggStroke = isMonster
                ? (collected ? "#fbbf24" : "rgba(255,255,255,0.55)")
                : (collected ? "white"   : "rgba(255,255,255,0.22)");
              const isTarget  = IS_DEV && i === (isMonster ? monsterEggs : eggsCollected); // next egg to earn
              const eggGlow   = collected
                ? isMonster
                  ? "drop-shadow(0 0 6px rgba(250,204,21,0.95)) drop-shadow(0 0 14px rgba(251,191,36,0.6))"
                  : "drop-shadow(0 0 5px rgba(255,255,255,0.7))"
                : "none";
              return (
                <span key={i}
                  onClick={IS_DEV ? () => devSetEggs(i) : undefined}
                  title={IS_DEV ? `DEV: set to ${i + 1} egg${i + 1 > 1 ? "s" : ""}` : undefined}
                  style={{
                    display: "inline-flex",
                    cursor: IS_DEV ? "pointer" : "default",
                    outline: isTarget ? "2px dashed rgba(255,255,255,0.4)" : undefined,
                    borderRadius: isTarget ? "50%" : undefined,
                  }}>
                <svg viewBox="0 0 512 512" width="20" height="20"
                  style={{ filter: eggGlow, transition: "all 0.35s" }}>
                  <path
                    d="M256 16C166 16 76 196 76 316c0 90 60 180 180 180s180-90 180-180c0-120-90-300-180-300z"
                    fill={eggFill}
                    stroke={eggStroke}
                    strokeWidth="18"
                  />
                  {(collected || isMonster) && (
                    <ellipse cx="190" cy="150" rx="35" ry="60"
                      fill={isMonster && collected ? "#fef08a" : "white"}
                      opacity={isMonster && !collected ? 0.18 : 0.35}
                      transform="rotate(-20 190 150)" />
                  )}
                </svg>
                </span>
              );
            })}
          </div>

          {/* Mobile odometer — compact, centered under levels, hidden on desktop */}
          {(() => {
            const isMonster = gamePhase === "monster";
            const s = isMonster ? "--.-" : odomKm.toFixed(1);
            const font = s.length >= 5 ? "text-base" : "text-xl";
            return (
              <button onClick={isMonster ? undefined : resetOdometer}
                title={isMonster ? "Odometer disabled in Monster Round" : "Tap to reset"}
                className={`flex md:hidden arcade-meter flex-col items-center px-3 py-1.5 transition-transform ${isMonster ? "opacity-40 cursor-not-allowed" : "active:scale-95 cursor-pointer"}`}>
                <div className={`digital-meter ${font} leading-none transition-all ${isMonster ? "text-slate-500" : "text-white"}`}>{s}</div>
                {!isMonster && currentQ.totalGiven != null && (
                  <div className="text-[20px] text-white leading-none mt-0.5">
                    Σ {currentQ.totalGiven.toFixed(1)} {config.unit}
                  </div>
                )}
              </button>
            );
          })()}
        </div>

        {/* Desktop odometer — right edge, large numbers, hidden on mobile */}
        {(() => {
          const isMonster = gamePhase === "monster";
          const s = isMonster ? "--.-" : odomKm.toFixed(1);
          const font = s.length >= 5 ? "text-xl" : s.length >= 4 ? "text-2xl" : "text-3xl";
          return (
            <button onClick={isMonster ? undefined : resetOdometer}
              title={isMonster ? "Odometer disabled in Monster Round" : "Tap to reset"}
              className={`hidden md:flex arcade-meter flex-col items-center px-5 py-2 text-center min-w-[120px] shrink-0 transition-transform ${isMonster ? "opacity-40 cursor-not-allowed" : "active:scale-95 cursor-pointer"}`}>
              <div className={`digital-meter ${font} transition-all ${isMonster ? "text-slate-500" : "text-white"}`}>{s}</div>
              {!isMonster && currentQ.totalGiven != null && (
                <div className="text-2xl text-white mt-1 leading-none">
                  Σ {currentQ.totalGiven.toFixed(1)} {config.unit}
                </div>
              )}
            </button>
          );
        })()}
      </div>

      {/* ── map ── */}
      <div
        className={`absolute inset-x-0 top-[184px] bottom-[86px] md:top-[96px] md:bottom-[92px] ${topPanel === "map" ? "z-40" : "z-20"}`}
        onClick={() => setTopPanel("map")}
      >
        <svg
          ref={svgRef}
          viewBox={tightViewBox}
          className="h-full w-full touch-none select-none"
        >
          {config.edges.map((edge, i) => {
            const A = config.stops[i];
            const B = config.stops[i + 1];
            const edgeStart = checkpoints[i];
            const edgeEnd   = checkpoints[i + 1];

            // Visited range is [minKm, maxKm] — extends in BOTH directions from the
            // start so backward routes (e.g. A→C where C is left of A) are colored.
            // minKm starts at routeStartKm and only decreases; maxKm only increases.
            const visitedFromT = clamp((minKm - edgeStart) / edge.distance, 0, 1);
            const visitedToT   = clamp((maxKm - edgeStart) / edge.distance, 0, 1);
            const visitedFromPt = { x: A.x + (B.x - A.x) * visitedFromT, y: A.y + (B.y - A.y) * visitedFromT };
            const visitedToPt   = { x: A.x + (B.x - A.x) * visitedToT,   y: A.y + (B.y - A.y) * visitedToT   };
            const showVisited = visitedToT > visitedFromT + 0.001;

            // Repeat overlay: dino went forward and has come back (posKm < maxKm).
            const repFromT = clamp((posKm - edgeStart) / edge.distance, 0, 1);
            const repFromPt = { x: A.x + (B.x - A.x) * repFromT, y: A.y + (B.y - A.y) * repFromT };
            const showRepeat = maxKm > posKm + 0.05 && visitedToT > repFromT + 0.001;

            const mx = (A.x + B.x) / 2;
            const myCentre = (A.y + B.y) / 2;       // true midpoint on the track
            const my = myCentre - 28;                // label above track (normal edges)
            const isHidden = currentQ.hiddenEdge === i;
            void edgeEnd;

            // Is this edge part of the current question's route?
            const isRouteEdge = routeStops.has(config.stops[i].id) &&
                                routeStops.has(config.stops[i + 1].id);

            return (
              <g key={edge.from}>
                {/* dark unlit road */}
                <line x1={A.x} y1={A.y} x2={B.x} y2={B.y}
                  stroke="rgba(0,0,0,0.5)" strokeWidth={34} strokeLinecap="round" />
                <line x1={A.x} y1={A.y} x2={B.x} y2={B.y}
                  stroke="#1a2a3a" strokeWidth={26} strokeLinecap="round" />
                {/* faint route highlight — so player knows the question path */}
                {isRouteEdge && (
                  <line x1={A.x} y1={A.y} x2={B.x} y2={B.y}
                    stroke={pal.trail} strokeWidth={14} strokeLinecap="round" opacity={0.18} />
                )}
                {showVisited && (
                  <line x1={visitedFromPt.x} y1={visitedFromPt.y} x2={visitedToPt.x} y2={visitedToPt.y}
                    stroke={pal.visited} strokeWidth={14} strokeLinecap="round" />
                )}
                {showRepeat && (
                  <>
                    {/* backward track — wider base + bright centre stripe to look distinct */}
                    <line x1={repFromPt.x} y1={repFromPt.y} x2={visitedToPt.x} y2={visitedToPt.y}
                      stroke={pal.repeated} strokeWidth={18} strokeLinecap="round" opacity={0.7} />
                    <line x1={repFromPt.x} y1={repFromPt.y} x2={visitedToPt.x} y2={visitedToPt.y}
                      stroke="white" strokeWidth={4} strokeLinecap="round" opacity={0.45}
                      strokeDasharray="20 16" />
                  </>
                )}
                {/* white centre dashes — always on top of all fills */}
                <line x1={A.x} y1={A.y} x2={B.x} y2={B.y}
                  stroke="rgba(255,255,255,0.22)" strokeWidth={3}
                  strokeDasharray="18 14" strokeLinecap="round" />
                {/* distance label — sits above track for normal edges */}
                {!isHidden && (
                  <text x={mx} y={my} textAnchor="middle" fontSize="27" fontWeight="900"
                    fill={pal.text}
                    stroke="rgba(0,0,0,0.8)" strokeWidth={4} paintOrder="stroke">
                    {`${edge.distance.toFixed(1)} ${config.unit}`}
                  </text>
                )}
                {isHidden && (
                  <text x={mx} y={my + 10}
                    textAnchor="middle" fontSize="54" fontWeight="900"
                    fill={pal.accent}
                    stroke="rgba(0,0,0,0.8)" strokeWidth={6} paintOrder="stroke">
                    ?
                  </text>
                )}
              </g>
            );
          })}

          {config.stops.map((stop) => {
            const routeFirst = config.stops[currentQ.route[0]].id;
            const routeLast  = config.stops[currentQ.route[currentQ.route.length - 1]].id;
            return (
              <StopMarker
                key={stop.id}
                stop={stop}
                active={routeStops.has(stop.id)}
                isFirst={stop.id === routeFirst}
                isLast={stop.id === routeLast && routeLast !== routeFirst}
                palette={pal}
              />
            );
          })}

          <g
            transform={`translate(${token.x}, ${token.y - 44})`}
            onPointerDown={(e) => { e.stopPropagation(); startDrag(e); }}
            style={{ cursor: dragging ? "grabbing" : "grab" }}
          >
            {/* generous transparent hit area */}
            <circle cx={0} cy={-10} r={80} fill="transparent" />
            <RexSprite dino={dino} dinoColor={dinoColor} walking={walking} facingLeft={facingLeft} />
          </g>

          {/* Halo rendered last so it always paints above stop markers */}
          {dragging && (
            <g transform={`translate(${token.x}, ${token.y - 44})`} style={{ pointerEvents: "none" }}>
              <circle cx={0} cy={-48} r={62}
                fill="none"
                stroke="#4ade80"
                strokeWidth={10}
                opacity={0.35}
              />
              <circle cx={0} cy={-48} r={62}
                fill="none"
                stroke="#4ade80"
                strokeWidth={4}
                style={{
                  filter: "drop-shadow(0 0 6px #4ade80) drop-shadow(0 0 16px #22c55e) drop-shadow(0 0 32px #16a34a)",
                }}
              />
            </g>
          )}
        </svg>
      </div>

      {/* ── bottom bar ── */}
      <div
        className={`absolute bottom-0 left-0 right-0 px-3 pb-3 md:px-5 md:pb-4 z-50`}
        onClick={() => setTopPanel("question")}
      >
        {/* L3 distance comparison visual — appears after each step is confirmed */}
        {currentQ.subAnswers && currentQ.promptLines && subStep >= 1 && (() => {
          const d1 = currentQ.subAnswers![0];
          const d2 = currentQ.subAnswers![1];
          const showBoth = subStep >= 2;
          const maxD = showBoth ? Math.max(d1, d2) : d1;
          // Derive station names directly from stored hubStop index
          const hubIdx = currentQ.hubStop!;
          const hub   = config.stops[hubIdx].label;
          const dest1 = config.stops[hubIdx - 1].label;
          const dest2 = config.stops[hubIdx + 1].label;
          // SVG layout constants
          const W = 380, PAD_L = 8, PAD_R = 8;
          const lineX0 = PAD_L + 6;
          const lineX1max = W - PAD_R - 6;
          const usableW = lineX1max - lineX0;
          const x1end = lineX0 + (d1 / maxD) * usableW;        // line 1 end (proportional)
          const x2end = lineX0 + (d2 / maxD) * usableW;        // line 2 end (proportional)
          const xLong = Math.max(x1end, x2end);
          const xShort = Math.min(x1end, x2end);
          const bar1Color = "#4ade80";
          const bar2Color = "#f472b6";
          const diffColor = "#fde047";
          const svgH = showBoth ? 100 : 50;
          return (
            <div className="arcade-panel mb-2 px-2 py-1.5">
              <svg viewBox={`0 0 ${W} ${svgH}`} width="100%" height={svgH}
                style={{ display: "block", overflow: "visible" }}>
                {/* ── Segment 1 ── */}
                <line x1={lineX0} y1={22} x2={x1end} y2={22}
                  stroke={bar1Color} strokeWidth={5} strokeLinecap="round" />
                <circle cx={lineX0} cy={22} r={6} fill={bar1Color} />
                <circle cx={x1end} cy={22} r={6} fill={bar1Color} />
                {/* hub label left-anchored at start */}
                <text x={lineX0} y={42} fontSize={14} fill="#94a3b8" textAnchor="middle">{hub}</text>
                {/* dest1 centred on endpoint dot */}
                <text x={x1end} y={14} fontSize={14} fill={bar1Color} textAnchor="middle">{dest1}</text>
                {/* dist1 — centred on the segment */}
                <text x={(lineX0 + x1end) / 2} y={42} fontSize={14} fill={bar1Color} fontWeight="bold" textAnchor="middle">
                  {d1.toFixed(1)} {config.unit}
                </text>

                {showBoth && <>
                  {/* ── Segment 2 ── */}
                  <line x1={lineX0} y1={68} x2={x2end} y2={68}
                    stroke={bar2Color} strokeWidth={5} strokeLinecap="round" />
                  <circle cx={lineX0} cy={68} r={6} fill={bar2Color} />
                  <circle cx={x2end} cy={68} r={6} fill={bar2Color} />
                  {/* dest2 centred on endpoint dot */}
                  <text x={x2end} y={60} fontSize={14} fill={bar2Color} textAnchor="middle">{dest2}</text>
                  {/* dist2 — centred on the segment */}
                  <text x={(lineX0 + x2end) / 2} y={88} fontSize={14} fill={bar2Color} fontWeight="bold" textAnchor="middle">
                    {d2.toFixed(1)} {config.unit}
                  </text>

                  {/* ── Difference bracket ──
                      Anchored at the y-level of the shorter segment so it
                      attaches to its endpoint and never overlaps any label. */}
                  {(() => {
                    const bY = d1 <= d2 ? 22 : 68;   // y of the shorter segment
                    return (<>
                      <line x1={xShort} y1={bY} x2={xLong} y2={bY}
                        stroke={diffColor} strokeWidth={3} strokeLinecap="round" strokeDasharray="5 4" />
                      <line x1={xShort} y1={bY - 8} x2={xShort} y2={bY + 8} stroke={diffColor} strokeWidth={2} />
                      <line x1={xLong}  y1={bY - 8} x2={xLong}  y2={bY + 8} stroke={diffColor} strokeWidth={2} />
                      {/* "?" below the bracket — always in clear space */}
                      <text x={(xShort + xLong) / 2} y={bY + 16} fontSize={16} fill={diffColor}
                        fontWeight="bold" textAnchor="middle">?</text>
                    </>);
                  })()}
                </>}
              </svg>
            </div>
          );
        })()}

        <div className="flex items-end gap-2 md:gap-3">
          {currentQ.promptLines && currentQ.subAnswers ? (
            /* ── Level 3: stepped one-at-a-time ── */
            <div className="arcade-panel flex-1 flex flex-col gap-2 px-4 py-2.5">
              {currentQ.promptLines.map((line, i) => {
                const isDone    = i < subStep;
                const isCurrent = i === subStep;
                return (
                  <div key={i} className={`flex items-center gap-2 transition-opacity duration-200 ${i > subStep ? "opacity-30" : ""}`}>
                    <ColoredPrompt text={line}
                      className={`flex-1 text-sm leading-5 font-bold ${i === 2 ? "text-white" : "text-slate-300"}`} />
                    {IS_DEV && currentQ.subAnswers && (
                      <span className="shrink-0 rounded px-1 text-[10px] font-black"
                        style={{ background: "rgba(250,204,21,0.18)", color: "#fde047", border: "1px solid rgba(250,204,21,0.3)" }}>
                        {currentQ.subAnswers[i].toFixed(1)}
                      </span>
                    )}
                    <span className="text-slate-400 text-sm">=</span>
                    {isDone ? (
                      /* completed step — confirmed value */
                      <div className="w-20 flex items-center justify-end gap-1">
                        <span className="text-green-400 text-sm font-bold">{subAnswers[i]} {config.unit}</span>
                      </div>
                    ) : isCurrent ? (
                      <div
                        className="w-20 rounded-lg border-[3px] border-white/70 bg-slate-950 px-2 py-1 text-sm text-cyan-300 text-right digital-meter"
                        aria-live="polite"
                      >
                        {subAnswers[i] || "0"}
                      </div>
                    ) : (
                      /* future step — empty placeholder */
                      <div className="w-20 h-[34px] rounded-lg border-[2px] border-white/15 bg-slate-950/40" />
                    )}
                    <div className={`shrink-0 h-8 w-8 ${!isCurrent ? "opacity-30" : ""}`} />
                  </div>
                );
              })}
            </div>
          ) : (
            /* ── Level 1 / 2: single row ── */
            <div className="arcade-panel flex-1 flex items-center gap-2 px-4 py-2 min-h-[60px] text-sm md:text-base leading-6 text-white font-bold">
              <ColoredPrompt text={currentQ.prompt} />
              {IS_DEV && (
                <span className="ml-1 shrink-0 rounded px-1.5 py-0.5 text-xs font-black"
                  style={{ background: "rgba(250,204,21,0.18)", color: "#fde047", border: "1px solid rgba(250,204,21,0.35)" }}>
                  {currentQ.answer.toFixed(1)}
                </span>
              )}
            </div>
          )}
          <NumericKeypad
            value={keypadValue}
            onChange={handleKeypadChange}
            onSubmit={submitAnswer}
            canSubmit={canKeypadSubmit}
          />
        </div>
      </div>

      {/* dino name + attribution */}
      <div className="pointer-events-none absolute bottom-[90px] right-3 z-10 text-right leading-5">
        <div className="text-[10px] font-black tracking-widest uppercase" style={{ color: dinoColor }}>
          {dino.name}
        </div>
        <a
          href={dino.url}
          target="_blank"
          rel="noopener noreferrer"
          className="pointer-events-auto text-[8px] text-slate-600 hover:text-slate-400 transition-colors"
        >
          {dino.author} / game-icons.net / CC BY 3.0
        </a>
        <a
          href="https://game-icons.net/1x1/sbed/big-egg.html"
          target="_blank"
          rel="noopener noreferrer"
          className="pointer-events-auto text-[8px] text-slate-600 hover:text-slate-400 transition-colors"
        >
          sbed / game-icons.net / CC BY 3.0
        </a>
      </div>

      {flash && (
        flash.icon ? (
          /* big tick / cross icon — centred on screen */
          <div className="pointer-events-none absolute inset-0 z-50 overflow-hidden">
            {flash.ok ? (
              /* ✓ green tick */
              <svg
                viewBox="0 0 120 120" width="220" height="220"
                style={{
                  position: "absolute", top: "38%", left: "50%",
                  animation: "icon-pop 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards",
                  filter: "drop-shadow(0 0 24px #4ade80) drop-shadow(0 0 48px #16a34a)",
                }}
              >
                <circle cx="60" cy="60" r="54" fill="#052e16" opacity="0.82" />
                <circle cx="60" cy="60" r="54" fill="none" stroke="#4ade80" strokeWidth="5" />
                <path d="M30 62 L50 82 L90 38"
                  fill="none" stroke="#4ade80" strokeWidth="13"
                  strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              /* ✗ red cross */
              <svg
                viewBox="0 0 120 120" width="220" height="220"
                style={{
                  position: "absolute", top: "38%", left: "50%",
                  animation: "icon-pop-wrong 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards",
                  filter: "drop-shadow(0 0 24px #f87171) drop-shadow(0 0 48px #b91c1c)",
                }}
              >
                <circle cx="60" cy="60" r="54" fill="#2d0a0a" opacity="0.82" />
                <circle cx="60" cy="60" r="54" fill="none" stroke="#f87171" strokeWidth="5" />
                <path d="M38 38 L82 82 M82 38 L38 82"
                  fill="none" stroke="#f87171" strokeWidth="13"
                  strokeLinecap="round" />
              </svg>
            )}
          </div>
        ) : (
          /* text flash for validation messages */
          <div className={`pointer-events-none absolute left-1/2 top-[30%] z-40 -translate-x-1/2 rounded-xl border-2 px-8 py-4 text-2xl font-black uppercase tracking-widest animate-bounce-in ${flash.ok ? "border-emerald-400 bg-emerald-950/90 text-emerald-300" : "border-pink-400 bg-pink-950/90 text-pink-300"}`}>
            {flash.text}
          </div>
        )
      )}

      {/* ── Game Over / All Levels Complete ── */}
      {screen === "gameover" && (
        <div className="absolute inset-0 z-[80] flex items-center justify-center"
          style={{ background: "radial-gradient(ellipse at center, rgba(88,28,135,0.97) 0%, rgba(5,2,18,0.99) 80%)" }}>
          <div className="arcade-panel p-8 md:p-12 text-center mx-6 max-w-lg w-full"
            style={{ boxShadow: "0 0 40px rgba(251,191,36,0.35), 0 0 80px rgba(109,40,217,0.3)" }}>

            {/* Dino row */}
            <div className="flex justify-center gap-3 text-4xl mb-4">
              <span>🦕</span><span>🦖</span><span>🦕</span>
            </div>

            <div className="text-3xl md:text-4xl font-black uppercase tracking-widest text-yellow-300"
              style={{ textShadow: "0 0 24px rgba(250,204,21,0.8), 0 0 48px rgba(250,204,21,0.35)" }}>
              You Did It!
            </div>
            <div className="mt-2 text-base md:text-lg text-purple-200 font-bold tracking-wide">
              All 3 Levels Mastered
            </div>
            <div className="mt-1 text-sm text-purple-400">
              Including every Monster Round!
            </div>

            {/* 5 golden eggs */}
            <div className="flex justify-center gap-2 mt-5">
              {[0,1,2,3,4].map((i) => (
                <svg key={i} viewBox="0 0 512 512" width="34" height="34"
                  style={{ filter: "drop-shadow(0 0 8px rgba(250,204,21,0.95)) drop-shadow(0 0 18px rgba(251,191,36,0.55))" }}>
                  <path d="M256 16C166 16 76 196 76 316c0 90 60 180 180 180s180-90 180-180c0-120-90-300-180-300z"
                    fill="#facc15" stroke="#fbbf24" strokeWidth="18" />
                  <ellipse cx="190" cy="150" rx="35" ry="60" fill="#fef08a" opacity="0.4" transform="rotate(-20 190 150)" />
                </svg>
              ))}
            </div>

            <button
              onClick={() => { setUnlockedLevel(1); beginNewRun(1); }}
              className="arcade-button mt-8 px-10 py-4 text-lg font-black uppercase tracking-wider w-full"
              style={{ boxShadow: "0 0 16px rgba(251,191,36,0.4), 0 6px 0 #78350f", borderColor: "#fbbf24" }}
            >
              Play Again
            </button>
          </div>
        </div>
      )}

      {/* Monster Round entry announcement — full-screen dramatic overlay */}
      {showMonsterAnnounce && (
        <div className="absolute inset-0 z-[70] flex flex-col items-center justify-center"
          style={{ background: "radial-gradient(ellipse at center, rgba(88,28,135,0.95) 0%, rgba(10,2,20,0.98) 75%)" }}>
          <div className="text-7xl mb-4" style={{ animation: "icon-pop 0.6s cubic-bezier(0.34,1.56,0.64,1) forwards" }}>🦕</div>
          <div className="text-4xl md:text-5xl font-black uppercase tracking-widest text-yellow-300 text-center px-4"
            style={{ textShadow: "0 0 30px rgba(250,204,21,0.8), 0 0 60px rgba(250,204,21,0.35)" }}>
            {monsterRoundName}
          </div>
          <div className="mt-5 text-lg text-purple-200 tracking-wide">No odometer — solve it in your head!</div>
          <div className="mt-2 text-xl text-yellow-400 font-black">Collect 5 Golden Eggs ✨</div>
        </div>
      )}

      {screen === "won" && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/75 p-6">
          <div className="arcade-panel p-10 text-center">
            {gamePhase === "monster" ? (
              <>
                <div className="text-4xl font-black uppercase tracking-[0.18em] text-yellow-300 md:text-5xl">
                  Level {level} Complete!
                </div>
                <div className="mt-1 text-lg text-purple-300 font-bold">🦕 Monster Round Crushed! 🦕</div>
                <div className="mt-2 flex items-center justify-center gap-1.5">
                  {[0,1,2,3,4].map((i) => (
                    <svg key={i} viewBox="0 0 512 512" width="28" height="28"
                      style={{ filter: "drop-shadow(0 0 6px rgba(250,204,21,0.95)) drop-shadow(0 0 14px rgba(251,191,36,0.6))" }}>
                      <path d="M256 16C166 16 76 196 76 316c0 90 60 180 180 180s180-90 180-180c0-120-90-300-180-300z"
                        fill="#facc15" stroke="#fbbf24" strokeWidth="18" />
                      <ellipse cx="190" cy="150" rx="35" ry="60" fill="#fef08a" opacity="0.4" transform="rotate(-20 190 150)" />
                    </svg>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="text-4xl font-black uppercase tracking-[0.18em] text-emerald-400 md:text-5xl">Level {level} Clear!</div>
                <div className="mt-2 text-xl text-yellow-300">🥚🥚🥚🥚🥚 All eggs collected!</div>
              </>
            )}
            <div className="mt-8 flex flex-col items-center gap-3">
              {level < 3 && (
                <button
                  onClick={() => beginNewRun((level + 1) as 1 | 2 | 3)}
                  className="arcade-button px-8 py-4 text-base md:text-lg"
                >
                  Next Level
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
