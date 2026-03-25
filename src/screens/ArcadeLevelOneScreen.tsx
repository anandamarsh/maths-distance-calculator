import { useCallback, useEffect, useRef, useState } from "react";
import {
  makeOneQuestion,
  generateTrailConfig,
  type TrailConfig,
  type TrailQuestion,
} from "../game/levelOne";
import { randomDino, type DinoSprite } from "../game/dinos";
import { playButton, playCorrect, playLevelComplete, playStep, playWrong, startMusic, shuffleMusic, toggleMute, isMuted } from "../sound";

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

// Returns true if the SVG position is within the visual dead zone of any stop node.
// Node radius is ~30px; we use 44px to give a comfortable margin.
const NODE_ZONE_PX = 44;
function inNodeZone(config: TrailConfig, svgX: number, svgY: number) {
  return config.stops.some((s) => Math.hypot(svgX - s.x, svgY - s.y) < NODE_ZONE_PX);
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

// ─── Main component ───────────────────────────────────────────────────────────

export default function ArcadeLevelOneScreen() {
  const [level, setLevel] = useState<1 | 2 | 3>(1);
  const [unlockedLevel, setUnlockedLevel] = useState<1 | 2 | 3>(1);
  const [run, setRun] = useState(() => createRun(1));
  const [screen, setScreen] = useState<"playing" | "won">("playing");
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

  const svgRef = useRef<SVGSVGElement>(null);
  const draggingRef = useRef(false);
  const walkTimerRef = useRef<number | null>(null);
  const flashTimerRef = useRef<number | null>(null);
  const posKmRef = useRef(0);
  const minKmRef = useRef(0);
  const maxKmRef = useRef(0);
  const odometerRef = useRef(0);
  const lastStepRef = useRef(0);

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

    // Accumulate only real edge movement — snap handles the node dead zone
    odometerRef.current += delta;
    setOdomKm(odometerRef.current);

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
    setFlash(null);
    setDragging(false);
    setFacingLeft(false);
    const firstStartKm = getCheckpoints(next.config)[next.firstQ.route[0]];
    resetPosition(firstStartKm);
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
      playLevelComplete();
      if (!IS_DEV && level < 3) setUnlockedLevel((u) => Math.max(u, level + 1) as 1 | 2 | 3);
      setScreen("won");
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
    setEggsCollected((e) => Math.max(0, e - 1));
    setFlash({ text: "", ok: false, icon: true });
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = window.setTimeout(() => setFlash(null), 1100);
    const nextQ = makeOneQuestion(config, level, dino.nickname);
    setCurrentQ(nextQ);
    resetPosition(getCheckpoints(config)[nextQ.route[0]]);
  }

  function submitAnswer(e: React.FormEvent) {
    e.preventDefault();
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
      if (ok) { playCorrect(); earnEgg(); } else { loseEgg(); }
      return;
    }

    // ── Level 1 / 2 ──
    const guess = parseFloat(answer);
    if (isNaN(guess)) { showFlash("Type a number!", false); return; }
    const correct = Math.abs(guess - currentQ.answer) < 0.11;
    if (correct) { playCorrect(); earnEgg(); } else { loseEgg(); }
  }

  const pal = config.palette;

  return (
    <div
      className="relative h-svh w-screen overflow-hidden font-arcade"
      style={{ background: `radial-gradient(ellipse at top, ${pal.bgGlow} 0%, ${pal.bg} 72%)` }}
    >
      <div className="pointer-events-none absolute inset-0 arcade-grid opacity-20" />

      {/* ── top bar ── */}
      <div className="absolute left-0 right-0 top-0 z-20 flex items-start px-3 pt-2 md:px-5 md:pt-2">

        {/* Left icon buttons
            Mobile:  flex-col, mt-[60px] so they appear BELOW the shell home button
            Desktop: flex-row, ml-[64px] so they appear RIGHT OF the shell home button */}
        <div className="flex flex-col md:flex-row gap-2 mt-[76px] md:mt-0 md:ml-[64px] shrink-0">
          <button
            onClick={resetCurrentQuestion}
            title="Reset"
            className="arcade-button w-16 h-16 flex items-center justify-center p-3.5"
          >
            <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
              <path d="M1 4v6h6" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M23 20v-6h-6" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <button
            onClick={handleToggleMute}
            title={soundMuted ? "Unmute" : "Mute"}
            className="arcade-button w-16 h-16 flex items-center justify-center p-3.5"
            style={soundMuted ? { background: "linear-gradient(180deg,#475569,#334155)", boxShadow: "0 5px 0 #1e293b", borderColor: "#94a3b8" } : {}}
          >
            <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
              {soundMuted ? (
                <>
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="white"/>
                  <line x1="23" y1="9" x2="17" y2="15" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
                  <line x1="17" y1="9" x2="23" y2="15" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
                </>
              ) : (
                <>
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="white"/>
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
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
                    background: locked ? "#0f172a" : level === lv ? "#0ea5e9" : "#1e293b",
                    borderColor: locked ? "#1e293b" : level === lv ? "#38bdf8" : "#475569",
                    color: locked ? "#334155" : level === lv ? "white" : "#64748b",
                    cursor: locked ? "not-allowed" : "pointer",
                    opacity: locked ? 0.5 : 1,
                  }}
                >
                  {locked ? "🔒" : lv}
                </button>
              );
            })}
          </div>

          {/* 5-egg collector — sbed / game-icons.net / CC BY 3.0 */}
          <div className="flex items-center gap-1.5" title={`${eggsCollected}/5 eggs`}>
            {[0, 1, 2, 3, 4].map((i) => {
              const collected = i < eggsCollected;
              return (
                <svg
                  key={i}
                  viewBox="0 0 512 512"
                  width="20"
                  height="20"
                  style={{
                    filter: collected ? "drop-shadow(0 0 5px rgba(255,255,255,0.7))" : "none",
                    transition: "all 0.35s",
                  }}
                >
                  <path
                    d="M256 16C166 16 76 196 76 316c0 90 60 180 180 180s180-90 180-180c0-120-90-300-180-300z"
                    fill={collected ? "white" : "transparent"}
                    stroke={collected ? "white" : "rgba(255,255,255,0.22)"}
                    strokeWidth="18"
                  />
                  {/* gleam inside collected egg */}
                  {collected && (
                    <ellipse cx="190" cy="150" rx="35" ry="60" fill="white" opacity="0.25" transform="rotate(-20 190 150)" />
                  )}
                </svg>
              );
            })}
          </div>

          {/* Mobile odometer — compact, centered under levels, hidden on desktop */}
          {(() => {
            const s = odomKm.toFixed(1);
            const font = s.length >= 5 ? "text-base" : "text-xl";
            return (
              <button onClick={resetOdometer} title="Tap to reset" className="flex md:hidden arcade-meter flex-col items-center px-3 py-1.5 active:scale-95 transition-transform cursor-pointer">
                <div className={`digital-meter ${font} leading-none text-white transition-all`}>{s}</div>
                {currentQ.totalGiven != null && (
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
          const s = odomKm.toFixed(1);
          const font = s.length >= 5 ? "text-xl" : s.length >= 4 ? "text-2xl" : "text-3xl";
          return (
            <button onClick={resetOdometer} title="Tap to reset"
              className="hidden md:flex arcade-meter flex-col items-center px-5 py-2 text-center min-w-[120px] shrink-0 active:scale-95 transition-transform cursor-pointer">
              <div className={`digital-meter ${font} transition-all text-white`}>{s}</div>
              {currentQ.totalGiven != null && (
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
          // Parse "Hub → Dest" into two parts
          const [hub, dest1] = currentQ.promptLines![0].split(" → ");
          const dest2 = currentQ.promptLines![1].split(" → ")[1];
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
          const svgH = showBoth ? 112 : 50;
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
                {/* dist1 — same colour as segment */}
                <text x={x1end} y={42} fontSize={14} fill={bar1Color} fontWeight="bold" textAnchor="middle">
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
                  {/* dist2 — same colour as segment */}
                  <text x={x2end} y={106} fontSize={14} fill={bar2Color} fontWeight="bold" textAnchor="middle">
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

        <form onSubmit={submitAnswer} className="flex items-center gap-2 md:gap-3">
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
                    <span className="text-slate-400 text-sm">=</span>
                    {isDone ? (
                      /* completed step — confirmed value */
                      <div className="w-20 flex items-center justify-end gap-1">
                        <span className="text-green-400 text-sm font-bold">{subAnswers[i]} {config.unit}</span>
                      </div>
                    ) : isCurrent ? (
                      <input
                        autoFocus
                        value={subAnswers[i]}
                        onChange={(e) => setSubAnswers((prev) => {
                          const next = [...prev] as [string, string, string];
                          next[i] = e.target.value;
                          return next;
                        })}
                        inputMode="decimal"
                        placeholder={config.unit}
                        className="w-20 rounded-lg border-[3px] border-white/70 bg-slate-950 px-2 py-1 text-sm text-white outline-none placeholder:text-slate-500 text-right"
                      />
                    ) : (
                      /* future step — empty placeholder */
                      <div className="w-20 h-[34px] rounded-lg border-[2px] border-white/15 bg-slate-950/40" />
                    )}
                    {/* tick button — always present, disabled unless current row */}
                    <button type="submit" disabled={!isCurrent}
                      className={`arcade-button shrink-0 h-8 w-8 flex items-center justify-center p-0 transition-opacity ${!isCurrent ? "opacity-30 cursor-not-allowed" : ""}`}>
                      <svg viewBox="0 0 24 24" fill="none" className="w-4 h-4" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 13 L9 18 L20 7" stroke="white" strokeWidth="3"/>
                      </svg>
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            /* ── Level 1 / 2: single row ── */
            <div className="arcade-panel flex-1 flex items-center px-4 py-2 min-h-[60px] text-sm md:text-base leading-6 text-white font-bold">
              <ColoredPrompt text={currentQ.prompt} />
            </div>
          )}
          {/* Big submit button only for L1 / L2 */}
          {!currentQ.promptLines && (
            <>
              <input
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                inputMode="decimal"
                placeholder={config.unit}
                className="w-[96px] md:w-[120px] shrink-0 rounded-xl border-[3px] border-white/70 bg-slate-950 px-3 py-2.5 text-base md:text-lg text-white outline-none placeholder:text-slate-500"
              />
              <button type="submit" title="Submit" className="arcade-button shrink-0 rounded-full w-14 h-14 flex items-center justify-center p-0">
                <svg viewBox="0 0 24 24" fill="none" className="w-7 h-7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 13 L9 18 L20 7" stroke="white" strokeWidth="3"/>
                </svg>
              </button>
            </>
          )}
        </form>
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

      {screen === "won" && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/75 p-6">
          <div className="arcade-panel p-10 text-center">
            <div className="text-4xl font-black uppercase tracking-[0.18em] text-emerald-400 md:text-5xl">Level {level} Clear!</div>
            <div className="mt-2 text-xl text-yellow-300">🥚🥚🥚🥚🥚 All eggs collected!</div>
            <div className="mt-8 flex flex-col items-center gap-3">
              {level < 3 && (
                <button
                  onClick={() => beginNewRun((level + 1) as 1 | 2 | 3)}
                  className="arcade-button px-8 py-4 text-base md:text-lg"
                >
                  Next Level →
                </button>
              )}
              <button
                onClick={() => beginNewRun()}
                className="text-slate-400 underline text-sm"
              >
                Play again
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
