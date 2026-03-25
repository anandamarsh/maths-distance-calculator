import { useCallback, useEffect, useRef, useState } from "react";
import {
  generateLevelOneQuestions,
  generateLevelThreeQuestions,
  generateLevelTwoQuestions,
  generateTrailConfig,
  type TrailConfig,
  type TrailQuestion,
} from "../game/levelOne";
import { playButton, playCorrect, playLevelComplete, playStep, playWrong, startMusic } from "../sound";

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

function makeQuestions(config: TrailConfig, level: number): TrailQuestion[] {
  if (level === 2) return generateLevelTwoQuestions(config, 5);
  if (level === 3) return generateLevelThreeQuestions(config, 5);
  return generateLevelOneQuestions(config, 5);
}

function createRun(level: number) {
  const config = generateTrailConfig();
  return { config, questions: makeQuestions(config, level) };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function RexSprite({ walking, facingLeft }: { walking: boolean; facingLeft: boolean }) {
  return (
    <g style={{ transform: facingLeft ? "scaleX(-1)" : undefined }}>
      <g className={walking ? "dino-walk" : ""}>
        <ellipse cx={0} cy={54} rx={32} ry={9} fill="rgba(0,0,0,0.28)" />
        <path d="M -16 8 Q -40 20 -52 10 Q -62 2 -54 -6" fill="none" stroke="#15803d" strokeWidth={15} strokeLinecap="round" />
        <path d="M -54 -6 Q -64 -16 -56 -22" fill="none" stroke="#15803d" strokeWidth={9} strokeLinecap="round" />
        <ellipse cx={0} cy={4} rx={22} ry={19} fill="#22c55e" stroke="#15803d" strokeWidth={4} />
        <path d="M 12 -10 Q 24 -28 30 -20" fill="none" stroke="#22c55e" strokeWidth={18} strokeLinecap="round" />
        <ellipse cx={34} cy={-24} rx={17} ry={12} fill="#22c55e" stroke="#15803d" strokeWidth={3.5} />
        <ellipse cx={38} cy={-34} rx={10} ry={7} fill="#22c55e" stroke="#15803d" strokeWidth={3} />
        <circle cx={44} cy={-30} r={5} fill="white" stroke="#15803d" strokeWidth={2} />
        <circle cx={45.5} cy={-29} r={2.5} fill="#0f172a" />
        <circle cx={46.5} cy={-30.5} r={1} fill="white" />
        <circle cx={51} cy={-20} r={2} fill="#15803d" />
        <path d="M 36 -16 L 52 -16" stroke="#15803d" strokeWidth={2.5} />
        <path d="M 40 -16 L 39 -11 M 46 -16 L 45 -11" stroke="white" strokeWidth={2.5} strokeLinecap="round" />
        <path d="M 13 -6 L 22 2 L 18 6" stroke="#15803d" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <line x1={-7} y1={21} x2={-7} y2={48} stroke="#15803d" strokeWidth={11} strokeLinecap="round" />
        <path d="M -7 48 L -17 56 M -7 48 L 3 56" stroke="#15803d" strokeWidth={8} strokeLinecap="round" />
        <line x1={9} y1={21} x2={9} y2={48} stroke="#15803d" strokeWidth={11} strokeLinecap="round" />
        <path d="M 9 48 L -1 56 M 9 48 L 19 56" stroke="#15803d" strokeWidth={8} strokeLinecap="round" />
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
  const [screen, setScreen] = useState<"playing" | "failed" | "won">("playing");
  const [qIndex, setQIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [subAnswers, setSubAnswers] = useState<[string, string, string]>(["", "", ""]);
  const [posKm, setPosKm] = useState(0);
  const [maxKm, setMaxKm] = useState(0);
  const [odomKm, setOdomKm] = useState(0);
  const [walking, setWalking] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [facingLeft, setFacingLeft] = useState(false);
  const [meterPaused, setMeterPaused] = useState(false);
  const [flash, setFlash] = useState<{ text: string; ok: boolean } | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);
  const draggingRef = useRef(false);
  const walkTimerRef = useRef<number | null>(null);
  const flashTimerRef = useRef<number | null>(null);
  const posKmRef = useRef(0);
  const odometerRef = useRef(0);
  const lastStepRef = useRef(0);
  const meterPausedRef = useRef(false);

  const { config, questions } = run;
  const currentQ: TrailQuestion = questions[qIndex];
  const checkpoints = getCheckpoints(config);
  const token = posAtKm(config, posKm, checkpoints);
  const routeStops = new Set(currentQ.route.map((i) => config.stops[i].id));

  useEffect(() => { startMusic(); }, []);

  const moveRex = useCallback((nextKm: number, svgX: number, svgY: number) => {
    const cp = getCheckpoints(run.config);
    const clamped = clamp(nextKm, 0, totalKm(run.config));
    const prev = posKmRef.current;
    const delta = Math.abs(clamped - prev);
    if (delta < 0.001) return;

    posKmRef.current = clamped;
    setPosKm(clamped);
    setMaxKm((m) => Math.max(m, clamped));
    setFacingLeft(clamped < prev);

    // Only accumulate odometer when outside a node's dead zone
    if (!meterPausedRef.current && !inNodeZone(run.config, svgX, svgY)) {
      odometerRef.current += delta;
      setOdomKm(odometerRef.current);
    }

    if (odometerRef.current - lastStepRef.current >= 0.35) {
      playStep();
      lastStepRef.current = odometerRef.current;
    }
    setWalking(true);
    if (walkTimerRef.current) clearTimeout(walkTimerRef.current);
    walkTimerRef.current = window.setTimeout(() => setWalking(false), 150);
    void cp;
  }, [run.config]);

  useEffect(() => {
    function onMove(e: PointerEvent) {
      if (!draggingRef.current || !svgRef.current) return;
      const { x, y } = toSVGPoint(svgRef.current, e.clientX, e.clientY);
      moveRex(projectToTrail(config, x, y, checkpoints), x, y);
    }
    function onUp() { draggingRef.current = false; setDragging(false); }
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [config, checkpoints, moveRex]);

  function startDrag(e: React.PointerEvent) {
    e.preventDefault();
    draggingRef.current = true;
    setDragging(true);
    if (svgRef.current) {
      const { x, y } = toSVGPoint(svgRef.current, e.clientX, e.clientY);
      moveRex(projectToTrail(config, x, y, checkpoints), x, y);
    }
  }

  function resetPosition() {
    posKmRef.current = 0;
    odometerRef.current = 0;
    lastStepRef.current = 0;
    meterPausedRef.current = false;
    setPosKm(0);
    setMaxKm(0);
    setOdomKm(0);
    setMeterPaused(false);
    setWalking(false);
    setAnswer("");
    setSubAnswers(["", "", ""]);
  }

  function beginNewRun(targetLevel?: 1 | 2 | 3) {
    playButton();
    const lv = targetLevel ?? level;
    const next = createRun(lv);
    if (targetLevel) setLevel(targetLevel);
    setRun(next);
    setScreen("playing");
    setQIndex(0);
    setFlash(null);
    setDragging(false);
    setFacingLeft(false);
    resetPosition();
  }

  function toggleMeter() {
    playButton();
    const next = !meterPaused;
    meterPausedRef.current = next;
    setMeterPaused(next);
  }

  function showFlash(text: string, ok: boolean) {
    setFlash({ text, ok });
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = window.setTimeout(() => setFlash(null), 1600);
  }

  function submitAnswer(e: React.FormEvent) {
    e.preventDefault();
    playButton();

    if (currentQ.subAnswers) {
      // Level 3: check all three inputs
      for (let i = 0; i < 3; i++) {
        const g = parseFloat(subAnswers[i]);
        if (isNaN(g)) { showFlash("Fill all 3!", false); return; }
        if (Math.abs(g - currentQ.subAnswers[i]) >= 0.11) { playWrong(); setScreen("failed"); return; }
      }
      playCorrect();
      if (qIndex === questions.length - 1) {
        playLevelComplete();
        if (!IS_DEV && level < 3) setUnlockedLevel((u) => Math.max(u, level + 1) as 1 | 2 | 3);
        setScreen("won");
        return;
      }
      showFlash("Correct!", true);
      setQIndex((i) => i + 1);
      resetPosition();
      return;
    }

    const guess = parseFloat(answer);
    if (isNaN(guess)) { showFlash("Type a number!", false); return; }
    if (Math.abs(guess - currentQ.answer) < 0.11) {
      playCorrect();
      if (qIndex === questions.length - 1) {
        playLevelComplete();
        if (!IS_DEV && level < 3) setUnlockedLevel((u) => Math.max(u, level + 1) as 1 | 2 | 3);
        setScreen("won");
        return;
      }
      showFlash("Correct!", true);
      setQIndex((i) => i + 1);
      resetPosition();
    } else {
      playWrong();
      setScreen("failed");
    }
  }

  const pal = config.palette;

  return (
    <div
      className="relative h-svh w-screen overflow-hidden font-arcade"
      style={{ background: `radial-gradient(ellipse at top, ${pal.bgGlow} 0%, ${pal.bg} 72%)` }}
    >
      <div className="pointer-events-none absolute inset-0 arcade-grid opacity-20" />

      {/* ── top bar ── */}
      <div className="absolute left-0 right-0 top-0 z-20 flex items-start justify-between px-4 pt-2 md:px-6 md:pt-2">

        {/* restart */}
        <button onClick={() => beginNewRun()} className="arcade-button w-16 h-16 text-2xl flex items-center justify-center ml-[56px]">
          ↺
        </button>

        {/* level selector — centred in the bar */}
        <div className="flex flex-col items-center gap-0.5">
          <div className="flex items-center gap-1.5">
            {([1, 2, 3] as const).map((lv) => {
              const locked = !IS_DEV && lv > unlockedLevel;
              return (
                <button
                  key={lv}
                  onClick={() => !locked && beginNewRun(lv)}
                  disabled={locked}
                  title={locked ? `Complete Level ${lv - 1} first` : undefined}
                  className="w-8 h-7 rounded text-xs font-black border-2 transition-colors"
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
          <div className="w-full h-2 rounded-full bg-slate-700 overflow-hidden mt-0.5">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${((qIndex + 1) / 5) * 100}%`, background: "#0ea5e9" }}
            />
          </div>
        </div>

        {/* speedometer box — odometer number + switch below */}
        <div className="arcade-meter flex flex-col items-center px-5 py-2 text-center min-w-[140px]">
          <div className="digital-meter text-2xl md:text-3xl"
            style={{ color: meterPaused ? "#475569" : "white" }}>
            {odomKm.toFixed(1)}
          </div>
          <div className="text-[9px] uppercase tracking-[0.3em] text-sky-200 mb-1.5">{config.unit}</div>
          {/* pause toggle */}
          <button onClick={toggleMeter} title={meterPaused ? "Resume" : "Pause"}>
            <div
              className="relative h-5 w-9 rounded-full border-2 transition-colors"
              style={{
                background: meterPaused ? "#1e293b" : "#0ea5e9",
                borderColor: meterPaused ? "#475569" : "#38bdf8",
              }}
            >
              <div
                className="absolute top-0.5 h-3 w-3 rounded-full transition-transform"
                style={{
                  background: meterPaused ? "#475569" : "white",
                  transform: meterPaused ? "translateX(2px)" : "translateX(18px)",
                  boxShadow: meterPaused ? "none" : "0 0 5px rgba(56,189,248,0.8)",
                }}
              />
            </div>
          </button>
        </div>
      </div>

      {/* ── map ── */}
      <div className="absolute inset-x-0 top-[88px] bottom-[86px] md:top-[96px] md:bottom-[92px]">
        <svg
          ref={svgRef}
          viewBox="0 0 1280 680"
          className="h-full w-full touch-none select-none"
          onPointerDown={startDrag}
        >
          {config.edges.map((edge, i) => {
            const A = config.stops[i];
            const B = config.stops[i + 1];
            const edgeStart = checkpoints[i];

            const visitedT = clamp((maxKm - edgeStart) / edge.distance, 0, 1);
            const visitedPt = { x: A.x + (B.x - A.x) * visitedT, y: A.y + (B.y - A.y) * visitedT };
            const repStartT = clamp((posKm - edgeStart) / edge.distance, 0, 1);
            const repStartPt = { x: A.x + (B.x - A.x) * repStartT, y: A.y + (B.y - A.y) * repStartT };
            const showRepeat = maxKm > posKm + 0.05 && visitedT > repStartT + 0.001;

            const mx = (A.x + B.x) / 2;
            const my = (A.y + B.y) / 2 - 28;
            const isHidden = currentQ.hiddenEdge === i;

            return (
              <g key={edge.from}>
                <line x1={A.x} y1={A.y} x2={B.x} y2={B.y}
                  stroke="rgba(0,0,0,0.55)" strokeWidth={34} strokeLinecap="round" />
                <line x1={A.x} y1={A.y} x2={B.x} y2={B.y}
                  stroke="#1e293b" strokeWidth={26} strokeLinecap="round" />
                <line x1={A.x} y1={A.y} x2={B.x} y2={B.y}
                  stroke="rgba(255,255,255,0.08)" strokeWidth={3}
                  strokeDasharray="18 14" strokeLinecap="round" />
                <line x1={A.x} y1={A.y} x2={B.x} y2={B.y}
                  stroke={pal.trail} strokeWidth={14} strokeLinecap="round" opacity={0.28} />
                {visitedT > 0.001 && (
                  <line x1={A.x} y1={A.y} x2={visitedPt.x} y2={visitedPt.y}
                    stroke={pal.visited} strokeWidth={14} strokeLinecap="round" />
                )}
                {showRepeat && (
                  <line x1={repStartPt.x} y1={repStartPt.y} x2={visitedPt.x} y2={visitedPt.y}
                    stroke={pal.repeated} strokeWidth={14} strokeLinecap="round" />
                )}
                {/* distance label — "?" for hidden edge in Level 2 */}
                <text x={mx} y={my} textAnchor="middle" fontSize="27" fontWeight="900"
                  fill={isHidden ? pal.accent : pal.text}
                  stroke="rgba(0,0,0,0.8)" strokeWidth={4} paintOrder="stroke">
                  {isHidden ? "?" : `${edge.distance.toFixed(1)} ${config.unit}`}
                </text>
              </g>
            );
          })}

          {config.stops.map((stop, i) => (
            <StopMarker
              key={stop.id}
              stop={stop}
              active={routeStops.has(stop.id)}
              isFirst={i === 0}
              isLast={i === config.stops.length - 1}
              palette={pal}
            />
          ))}

          <g transform={`translate(${token.x}, ${token.y - 44})`}>
            <circle cx={0} cy={10} r={68} fill="transparent"
              style={{ cursor: dragging ? "grabbing" : "grab" }} />
            <RexSprite walking={walking} facingLeft={facingLeft} />
          </g>
        </svg>
      </div>

      {/* ── bottom bar ── */}
      <div className="absolute bottom-0 left-0 right-0 z-20 px-3 pb-3 md:px-5 md:pb-4">
        <form onSubmit={submitAnswer} className="flex items-center gap-2 md:gap-3">
          {currentQ.promptLines && currentQ.subAnswers ? (
            /* ── Level 3: three-row layout ── */
            <div className="arcade-panel flex-1 flex flex-col gap-1.5 px-4 py-2.5">
              {currentQ.promptLines.map((line, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className={`flex-1 text-sm leading-5 ${i === 2 ? "text-white font-bold" : "text-slate-300"}`}>
                    {line}
                  </span>
                  <span className="text-slate-400 text-sm">=</span>
                  <input
                    value={subAnswers[i]}
                    onChange={(e) => setSubAnswers((prev) => {
                      const next = [...prev] as [string, string, string];
                      next[i] = e.target.value;
                      return next;
                    })}
                    inputMode="decimal"
                    placeholder={config.unit}
                    className="w-20 rounded-lg border-2 border-cyan-400 bg-slate-950 px-2 py-1 text-sm text-white outline-none placeholder:text-slate-500 text-right"
                  />
                </div>
              ))}
            </div>
          ) : (
            /* ── Level 1 / 2: single row ── */
            <div className="arcade-panel flex-1 flex items-center px-4 py-2 min-h-[60px] text-sm md:text-base leading-6 text-white">
              {currentQ.prompt}
            </div>
          )}
          {!currentQ.promptLines && (
            <input
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              inputMode="decimal"
              placeholder={config.unit}
              className="w-[96px] md:w-[120px] shrink-0 rounded-lg border-2 border-cyan-400 bg-slate-950 px-3 py-2.5 text-base md:text-lg text-white outline-none placeholder:text-slate-500"
            />
          )}
          <button type="submit" className="arcade-button shrink-0 px-4 py-2.5 text-xs md:text-sm whitespace-nowrap">
            Submit
          </button>
        </form>
      </div>

      {flash && (
        <div className={`pointer-events-none absolute left-1/2 top-[30%] z-40 -translate-x-1/2 rounded-xl border-2 px-8 py-4 text-2xl font-black uppercase tracking-widest animate-bounce-in ${flash.ok ? "border-emerald-400 bg-emerald-950/90 text-emerald-300" : "border-pink-400 bg-pink-950/90 text-pink-300"}`}>
          {flash.text}
        </div>
      )}

      {screen === "failed" && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/75 p-6">
          <div className="arcade-panel p-10 text-center">
            <div className="text-4xl font-black uppercase tracking-[0.18em] text-pink-400 md:text-5xl">Try Again</div>
            <div className="mt-2 text-lg text-slate-400 tracking-widest">Level {level}</div>
            <button onClick={() => beginNewRun()} className="arcade-button mt-8 px-8 py-4 text-base md:text-lg">Retry</button>
          </div>
        </div>
      )}

      {screen === "won" && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/75 p-6">
          <div className="arcade-panel p-10 text-center">
            <div className="text-4xl font-black uppercase tracking-[0.18em] text-emerald-400 md:text-5xl">Level {level} Clear!</div>
            <div className="mt-2 text-xl text-yellow-300">★ 5 in a row ★</div>
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
