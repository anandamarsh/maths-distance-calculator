import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  makeOneQuestion,
  generateTrailConfig,
  type TrailConfig,
  type TrailQuestion,
} from "../game/levelOne";
import { randomDino, type DinoSprite } from "../game/dinos";
import {
  playButton,
  playCorrect,
  playStep,
  playWrong,
  startMusic,
  shuffleMusic,
  switchToMonsterMusic,
  toggleMute,
  isMuted,
  playMonsterStart,
  playGoldenEgg,
  playMonsterVictory,
  playGameComplete,
  playKeyClick,
} from "../sound";
import { SocialComments, SocialShare, openCommentsComposer } from "../components/Social";
import dsegRegularWoff2Url from "dseg/fonts/DSEG7-Classic/DSEG7Classic-Regular.woff2?url";
import dsegBoldWoff2Url from "dseg/fonts/DSEG7-Classic/DSEG7Classic-Bold.woff2?url";

const fontDataUrlCache = new Map<string, Promise<string>>();

async function toDataUrl(url: string, mimeType: string) {
  let pending = fontDataUrlCache.get(url);
  if (!pending) {
    pending = fetch(url)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Unable to load font asset: ${response.status}`);
        }
        const blob = await response.blob();
        return await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            const result = reader.result;
            if (typeof result !== "string") {
              reject(new Error("Unable to encode font asset"));
              return;
            }
            resolve(result.replace(/^data:[^;]+;/, `data:${mimeType};`));
          };
          reader.onerror = () => reject(reader.error ?? new Error("Unable to read font asset"));
          reader.readAsDataURL(blob);
        });
      })
      .catch((error) => {
        fontDataUrlCache.delete(url);
        throw error;
      });
    fontDataUrlCache.set(url, pending);
  }
  return pending;
}

// ─── SVG coordinate helper ───────────────────────────────────────────────────

function toSVGPoint(svg: SVGSVGElement, clientX: number, clientY: number) {
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const r = pt.matrixTransform(ctm.inverse());
  return { x: r.x, y: r.y };
}

/** Numeric keypad readout — odometer uses the same size for the main value. */
const KEYPAD_DISPLAY_FONT_SIZE = "2.1rem";

/** Map odometer: fixed width for main readout (tabular). */
const ODOMETER_MAIN_WIDTH = "4ch";

/** SVG user-space point → position inside a map overlay (same coords as `position:absolute` on the map div). */
function svgUserToMapLocal(
  svg: SVGSVGElement,
  mapEl: HTMLElement,
  x: number,
  y: number,
) {
  const pt = svg.createSVGPoint();
  pt.x = x;
  pt.y = y;
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  const screen = pt.matrixTransform(ctm);
  const mr = mapEl.getBoundingClientRect();
  return { left: screen.x - mr.left, top: screen.y - mr.top };
}

function useIsMobileLandscape() {
  const [is, setIs] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia(
        "(hover: none) and (pointer: coarse) and (orientation: landscape)",
      ).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(
      "(hover: none) and (pointer: coarse) and (orientation: landscape)",
    );
    const handler = (e: MediaQueryListEvent) => setIs(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return is;
}

function useIsSmallMobileLandscape() {
  const [is, setIs] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia(
        "(hover: none) and (pointer: coarse) and (orientation: landscape) and (max-height: 430px)",
      ).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(
      "(hover: none) and (pointer: coarse) and (orientation: landscape) and (max-height: 430px)",
    );
    const handler = (e: MediaQueryListEvent) => setIs(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return is;
}

function useIsCoarsePointer() {
  const [is, setIs] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(hover: none) and (pointer: coarse)").matches,
  );
  useEffect(() => {
    const mq = window.matchMedia("(hover: none) and (pointer: coarse)");
    const handler = (e: MediaQueryListEvent) => setIs(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return is;
}

function addRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

// ─── Trail geometry ───────────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

/** `e.key` is layout-dependent (AZERTY etc.); `e.code` is the physical key. */
function digitFromKeyCode(code: string): string | undefined {
  const d = /^Digit(\d)$/.exec(code) ?? /^Numpad(\d)$/.exec(code);
  return d?.[1];
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
      const t = clamp(
        (clamped - start) / (config.edges[i].distance || 1),
        0,
        1,
      );
      const A = config.stops[i],
        B = config.stops[i + 1];
      return { x: A.x + (B.x - A.x) * t, y: A.y + (B.y - A.y) * t };
    }
  }
  const last = config.stops[config.stops.length - 1];
  return { x: last.x, y: last.y };
}

function projectToTrail(
  config: TrailConfig,
  svgX: number,
  svgY: number,
  checkpoints: number[],
) {
  let bestKm = 0;
  let bestDist = Infinity;
  for (let i = 0; i < config.edges.length; i++) {
    const A = config.stops[i],
      B = config.stops[i + 1];
    const dx = B.x - A.x,
      dy = B.y - A.y;
    const lenSq = dx * dx + dy * dy || 1;
    const t = clamp(((svgX - A.x) * dx + (svgY - A.y) * dy) / lenSq, 0, 1);
    const px = A.x + dx * t,
      py = A.y + dy * t;
    const d = Math.hypot(svgX - px, svgY - py);
    if (d < bestDist) {
      bestDist = d;
      bestKm = checkpoints[i] + config.edges[i].distance * t;
    }
  }
  return bestKm;
}

function shouldFaceLeftForRoute(route: number[]) {
  if (route.length < 2) return false;
  return route[route.length - 1] < route[0];
}

const IS_DEV = import.meta.env.DEV;
const IS_LOCALHOST_DEV =
  IS_DEV &&
  new Set(["localhost", "127.0.0.1", "::1"]).has(
    globalThis.location?.hostname ?? "",
  );

function readInitialLevel(): 1 | 2 | 3 {
  if (typeof window === "undefined") return 1;
  const raw = new URLSearchParams(window.location.search).get("level");
  if (raw === "2") return 2;
  if (raw === "3") return 3;
  return 1;
}

/** Eggs to collect per phase (normal white → Monster Round golden). */
const EGGS_PER_LEVEL = 10;
const EGG_INDICES = Array.from({ length: EGGS_PER_LEVEL }, (_, i) => i);
const SUCCESS_ICON_DURATION_MS = 1100;

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
const DINO_COLORS = [
  "#22c55e",
  "#34d399",
  "#4ade80",
  "#86efac",
  "#a3e635",
  "#facc15",
];

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
  "1-normal": { bg: "#080e1c", glow: "#1e3a5f", tint: "transparent" },
  "1-monster": {
    bg: "#0f0520",
    glow: "#5b21b6",
    tint: "rgba(109,40,217,0.08)",
  },
  "2-normal": { bg: "#071510", glow: "#14532d", tint: "transparent" },
  "2-monster": { bg: "#180a00", glow: "#92400e", tint: "rgba(234,88,12,0.1)" },
  "3-normal": { bg: "#07161a", glow: "#134e4a", tint: "transparent" },
  "3-monster": { bg: "#1a0508", glow: "#7f1d1d", tint: "rgba(220,38,38,0.1)" },
};

/** Highlights decimal numbers; optional stop / node names from the map (yellow, distinct from numeric yellow-300). */
function highlightPlaceNames(segment: string, labels: string[]) {
  const sorted = [...labels].sort((a, b) => b.length - a.length);
  if (!sorted.length) return segment;
  const escaped = sorted.map((l) => l.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp(`(${escaped.join("|")})`, "gi");
  const bits = segment.split(re);
  return bits.map((bit, j) => {
    const hit = sorted.find((l) => l.toLowerCase() === bit.toLowerCase());
    return hit ? (
      <span key={j} className="text-yellow-200 font-black">
        {bit}
      </span>
    ) : (
      bit
    );
  });
}

/** Renders text with numbers in yellow-300 and map node names in yellow-200. */
function ColoredPrompt({
  text,
  className = "",
  stopLabels,
}: {
  text: string;
  className?: string;
  stopLabels?: string[];
}) {
  const parts = text.split(/(\d+\.?\d*)/g);
  return (
    <span className={className}>
      {parts.map((p, i) =>
        /^\d+\.?\d*$/.test(p) ? (
          <span key={i} className="text-yellow-300 font-black">
            {p}
          </span>
        ) : stopLabels?.length ? (
          <span key={i}>{highlightPlaceNames(p, stopLabels)}</span>
        ) : (
          p
        ),
      )}
    </span>
  );
}

function RexSprite({
  dino,
  dinoColor,
  facingLeft,
}: {
  dino: DinoSprite;
  dinoColor: string;
  facingLeft: boolean;
}) {
  return (
    <g style={{ transform: facingLeft ? "scaleX(-1)" : undefined }}>
      <g>
        {/* icon centred at (0,0), scaled to ~100px, sitting just above y=0 */}
        <svg
          x={-50}
          y={-100}
          width={100}
          height={100}
          viewBox="0 0 512 512"
          overflow="visible"
        >
          <path d={dino.path} fill={dinoColor} />
        </svg>
      </g>
    </g>
  );
}

function StopMarker({
  stop,
  active,
  isFirst,
  isLast,
  palette,
  showEndpointLetters = true,
}: {
  stop: TrailConfig["stops"][0];
  active: boolean;
  isFirst: boolean;
  isLast: boolean;
  palette: TrailConfig["palette"];
  /** Level 3: hide S/F on route endpoints — use dot only. */
  showEndpointLetters?: boolean;
}) {
  const r = active ? 30 : 24;
  const showDot = !showEndpointLetters || (!isFirst && !isLast);
  const hubGlyph = isFirst ? "S" : "F";
  return (
    <g>
      {active && (
        <circle
          cx={stop.x}
          cy={stop.y}
          r={r + 14}
          fill={palette.accent}
          opacity={0.16}
        />
      )}
      <ellipse
        cx={stop.x + 3}
        cy={stop.y + r + 4}
        rx={r * 0.6}
        ry={r * 0.2}
        fill="rgba(0,0,0,0.35)"
      />
      <circle
        cx={stop.x}
        cy={stop.y}
        r={r}
        fill={active ? palette.node : "#1e293b"}
        stroke={active ? palette.accent : "#475569"}
        strokeWidth={active ? 5 : 3}
      />
      {showDot ? (
        <circle cx={stop.x} cy={stop.y} r={r * 0.18} fill="white" />
      ) : (
        <text
          x={stop.x}
          y={stop.y + 8}
          textAnchor="middle"
          fontSize={r * 0.72}
          fontWeight="900"
          fill="white"
        >
          {hubGlyph}
        </text>
      )}
      <text
        x={stop.x}
        y={stop.y + r + 22}
        textAnchor="middle"
        fontSize="21"
        fontWeight="800"
        fill={palette.text}
        stroke="rgba(0,0,0,0.8)"
        strokeWidth={3}
        paintOrder="stroke"
      >
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
  showDisplayHint = false,
  onDisplayHintConsumed,
  roundKey,
  defaultMinimized = false,
  toggleRef,
  minimizeRef,
  onMinimizedChange,
  displayHintVariant = "default",
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  canSubmit: boolean;
  showDisplayHint?: boolean;
  onDisplayHintConsumed?: () => void;
  roundKey?: number;
  defaultMinimized?: boolean;
  toggleRef?: React.MutableRefObject<(() => void) | null>;
  minimizeRef?: React.MutableRefObject<(() => void) | null>;
  onMinimizedChange?: (minimized: boolean) => void;
  displayHintVariant?: "default" | "display-center";
}) {
  const isCoarsePointer = useIsCoarsePointer();
  const isMobileLandscape = useIsMobileLandscape();
  const [minimized, setMinimized] = useState(defaultMinimized);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const activeKeyTimeoutRef = useRef<number | null>(null);
  const toggleMinimized = () =>
    setMinimized((m) => {
      const next = !m;
      if (m && !next && showDisplayHint) onDisplayHintConsumed?.();
      return next;
    });
  if (toggleRef) toggleRef.current = toggleMinimized;
  if (minimizeRef) minimizeRef.current = () => setMinimized(true);
  const defaultMinimizedRef = useRef(defaultMinimized);
  defaultMinimizedRef.current = defaultMinimized;

  useEffect(() => {
    setMinimized(defaultMinimizedRef.current);
  }, [roundKey]);

  useEffect(() => {
    if (defaultMinimized) {
      setMinimized(true);
    }
  }, [defaultMinimized]);

  useEffect(() => {
    onMinimizedChange?.(minimized);
  }, [minimized, onMinimizedChange]);

  useEffect(() => {
    return () => {
      if (activeKeyTimeoutRef.current !== null) {
        window.clearTimeout(activeKeyTimeoutRef.current);
      }
    };
  }, []);

  function flashKey(key: string) {
    setActiveKey(key);
    if (activeKeyTimeoutRef.current !== null) {
      window.clearTimeout(activeKeyTimeoutRef.current);
    }
    activeKeyTimeoutRef.current = window.setTimeout(() => {
      setActiveKey((current) => (current === key ? null : current));
      activeKeyTimeoutRef.current = null;
    }, 140);
  }

  function press(key: string) {
    playKeyClick();
    flashKey(key);
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
  const buttonHeightClass = isMobileLandscape
    ? "h-[56px]"
    : isCoarsePointer
      ? "h-[45px]"
      : "h-[55px] md:h-10";
  const base =
    `rounded flex items-center justify-center font-black select-none transition-transform active:scale-95 ${isMobileLandscape ? "text-[1.6875rem]" : "text-[1.5rem] md:text-[1.3125rem]"} ${buttonHeightClass}`;
  const digit = `${base} ${isMobileLandscape ? "text-[1.875rem]" : "text-[1.7rem] md:text-[1.5rem]"} bg-slate-800 text-slate-100 border border-slate-600/60`;
  const op = `${base} bg-slate-700/80 text-slate-100 border border-slate-500/60`;
  const pressedKeyStyle = {
    background: "#67e8f9",
    color: "#020617",
    borderColor: "#67e8f9",
    boxShadow: "0 0 16px rgba(103,232,249,0.45)",
  } satisfies React.CSSProperties;
  const defaultDisplayHandWidth = isCoarsePointer ? 60 : 90;
  const defaultDisplayHandHeight = isCoarsePointer ? 72 : 108;
  const centeredDisplayHandWidth = isCoarsePointer ? 70 : 53;
  const centeredDisplayHandHeight = isCoarsePointer ? 86 : 65;
  const centeredDisplayFingerTipX = centeredDisplayHandWidth * (30.53 / 80);
  const centeredDisplayFingerTipY = centeredDisplayHandHeight * (14.4 / 100);
  const showCenteredDisplayHint =
    showDisplayHint && displayHintVariant === "display-center";
  const showDisplayHandOnDisplay =
    showCenteredDisplayHint ||
    (showDisplayHint && isCoarsePointer && displayHintVariant === "default");
  const showDisplayHandOnKeypad =
    showDisplayHint && !isCoarsePointer && displayHintVariant === "default";
  const shellPaddingClass = minimized ? "px-1.5 py-1" : "p-1.5";
  const shellGapClass = minimized ? "gap-0" : "gap-1";
  const displayHeightClass = "h-14 md:h-12";

  return (
    <div
      className={`relative flex min-h-0 min-w-0 ${isMobileLandscape ? "w-[16.25rem]" : "w-[12.5rem] md:w-[13.75rem]"} shrink-0 flex-col self-start rounded-xl transition-[padding,gap] duration-300 ease-in-out ${shellPaddingClass} ${shellGapClass}`}
      style={{
        background: "rgba(2,6,23,0.97)",
        border: "4px solid rgba(56,189,248,0.45)",
        boxShadow:
          "0 0 18px rgba(56,189,248,0.12), inset 0 0 12px rgba(0,0,0,0.4)",
      }}
    >
      <div
        className={`relative rounded-lg px-3.5 flex shrink-0 items-center justify-end overflow-visible cursor-pointer transition-[height] duration-300 ease-in-out ${displayHeightClass}`}
        onClick={toggleMinimized}
        style={{
          fontFamily: "'DSEG7Classic', 'Courier New', monospace",
          fontWeight: 700,
          fontSize: KEYPAD_DISPLAY_FONT_SIZE,
          lineHeight: 1,
          background: "rgba(0,8,4,0.95)",
          border:
            minimized && !showDisplayHint
              ? "none"
              : showDisplayHint
                ? "none"
                : "2px solid rgba(56,189,248,0.28)",
          color: "#67e8f9",
          textShadow: showDisplayHint
            ? "none"
            : "0 0 12px rgba(103,232,249,0.85), 0 0 26px rgba(56,189,248,0.4)",
          boxShadow: "none",
          letterSpacing: "0.08em",
        }}
      >
        {display}
        {showDisplayHandOnDisplay && (
          <div
            className={
              showCenteredDisplayHint
                ? "pointer-events-none absolute left-1/2 top-1/2"
                : "pointer-events-none absolute left-2 top-1/2 translate-y-[-25%]"
            }
            style={{
              animation: "keypad-display-finger-fade 2.4s ease-in-out infinite",
              transform: showCenteredDisplayHint
                ? `translate(${ -centeredDisplayFingerTipX }px, ${ isCoarsePointer ? `calc(${-centeredDisplayFingerTipY}px - 20px)` : `${-centeredDisplayFingerTipY}px` })`
                : undefined,
            }}
          >
            <svg
              viewBox="0 0 80 100"
              width={
                showCenteredDisplayHint
                  ? centeredDisplayHandWidth
                  : defaultDisplayHandWidth
              }
              height={
                showCenteredDisplayHint
                  ? centeredDisplayHandHeight
                  : defaultDisplayHandHeight
              }
              overflow="visible"
              style={{ filter: "drop-shadow(0 0 8px rgba(103,232,249,0.65))" }}
            >
              <path
                d="M24.76,22.64V12.4c0-3.18,2.59-5.77,5.77-5.77,1.44,0,2.82,.54,3.89,1.51,1.07,1,1.72,2.33,1.85,3.76l.87,10.08c2.12-1.88,3.39-4.59,3.39-7.48,0-5.51-4.49-10-10-10s-10,4.49-10,10c0,3.29,1.62,6.29,4.23,8.14Z"
                fill="#67e8f9"
                stroke="rgba(2,6,23,0.98)"
                strokeWidth="4"
                strokeLinejoin="round"
                paintOrder="stroke"
              />
              <path
                d="M55.98,69.53c0-.14,.03-.28,.09-.41l4.48-9.92v-18.37c0-1.81-1.08-3.48-2.76-4.26-6.75-3.13-13.8-4.84-20.95-5.08-.51-.01-.92-.41-.97-.91l-1.6-18.5c-.08-.94-.51-1.82-1.2-2.46-.7-.63-1.6-.99-2.54-.99-2.08,0-3.77,1.69-3.77,3.77V48.48h-2v-13.32c-2.61,.46-4.69,2.65-4.91,5.36-.56,6.79-.53,14.06,.08,21.62,.28,3.44,2.42,6.52,5.58,8.05l4.49,2.18c.35,.17,.56,.52,.56,.9v2.23h25.42v-5.97Z"
                fill="#67e8f9"
                stroke="rgba(2,6,23,0.98)"
                strokeWidth="4"
                strokeLinejoin="round"
                paintOrder="stroke"
              />
            </svg>
          </div>
        )}
      </div>
      <div
        className="flex min-h-0 flex-col gap-0.5"
        style={{
          overflow: "hidden",
          maxHeight: minimized ? "0px" : "300px",
          opacity: minimized ? 0 : 1,
          pointerEvents: minimized ? "none" : "auto",
          transition: "max-height 0.4s ease-in-out, opacity 0.3s ease-in-out",
        }}
      >
        {showDisplayHandOnKeypad && !minimized && (
          <div
            className="pointer-events-none absolute left-1/2 z-10 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
            style={{
              top: "calc(58% + 30px)",
              animation: "keypad-display-finger-fade 2.4s ease-in-out infinite",
            }}
          >
            <svg
              viewBox="0 0 80 100"
              width="90"
              height="108"
              overflow="visible"
              style={{ filter: "drop-shadow(0 0 8px rgba(103,232,249,0.65))" }}
            >
              <path
                d="M24.76,22.64V12.4c0-3.18,2.59-5.77,5.77-5.77,1.44,0,2.82,.54,3.89,1.51,1.07,1,1.72,2.33,1.85,3.76l.87,10.08c2.12-1.88,3.39-4.59,3.39-7.48,0-5.51-4.49-10-10-10s-10,4.49-10,10c0,3.29,1.62,6.29,4.23,8.14Z"
                fill="#67e8f9"
                stroke="rgba(2,6,23,0.98)"
                strokeWidth="4"
                strokeLinejoin="round"
                paintOrder="stroke"
              />
              <path
                d="M55.98,69.53c0-.14,.03-.28,.09-.41l4.48-9.92v-18.37c0-1.81-1.08-3.48-2.76-4.26-6.75-3.13-13.8-4.84-20.95-5.08-.51-.01-.92-.41-.97-.91l-1.6-18.5c-.08-.94-.51-1.82-1.2-2.46-.7-.63-1.6-.99-2.54-.99-2.08,0-3.77,1.69-3.77,3.77V48.48h-2v-13.32c-2.61,.46-4.69,2.65-4.91,5.36-.56,6.79-.53,14.06,.08,21.62,.28,3.44,2.42,6.52,5.58,8.05l4.49,2.18c.35,.17,.56,.52,.56,.9v2.23h25.42v-5.97Z"
                fill="#67e8f9"
                stroke="rgba(2,6,23,0.98)"
                strokeWidth="4"
                strokeLinejoin="round"
                paintOrder="stroke"
              />
            </svg>
            <div
              className="rounded-full px-3 py-1 text-sm"
              style={{
                marginTop: "-1.5rem",
                background: "rgba(15,23,42,0.88)",
                border: "1px solid rgba(56,189,248,0.35)",
                color: "#67e8f9",
                fontWeight: 900,
                letterSpacing: "0.02em",
                whiteSpace: "nowrap",
              }}
            >
              Enter the Value
            </div>
          </div>
        )}
        {rows.map((row, r) => (
          <div key={r} className="grid grid-cols-4 gap-0.5">
            {row.map((btn) => (
              <button
                key={btn}
                type="button"
                onClick={() => press(btn)}
                className={/[0-9]/.test(btn) ? digit : op}
                style={activeKey === btn ? pressedKeyStyle : undefined}
              >
                {btn === "±" ? (
                  <span className={`${isMobileLandscape ? "text-[2.25rem]" : "text-[2.4rem] md:text-[2.1rem]"} leading-none`}>±</span>
                ) : btn === "⌫" ? (
                  <span className={`${isMobileLandscape ? "text-[2.475rem]" : "text-[2.8rem] md:text-[2.4rem]"} leading-none`}>⌫</span>
                ) : btn === "." ? (
                  <span className={`${isMobileLandscape ? "text-[2.475rem]" : "text-[2.8rem] md:text-[2.4rem]"} leading-none`}>.</span>
                ) : (
                  btn
                )}
              </button>
            ))}
          </div>
        ))}
        <div className="flex gap-0.5 mt-0.5">
          <button
            type="button"
            onClick={() => press("0")}
            className={`${digit} flex-[2]`}
            style={activeKey === "0" ? pressedKeyStyle : undefined}
          >
            0
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={!canSubmit}
            className={`${base} flex-[2] arcade-button disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className={isMobileLandscape ? "w-[1.6875rem] h-[1.6875rem]" : "w-8 h-8 md:w-7 md:h-7"}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
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
  const initialLevelRef = useRef<1 | 2 | 3>(readInitialLevel());
  const initialLevel = initialLevelRef.current;
  const [level, setLevel] = useState<1 | 2 | 3>(initialLevel);
  const [unlockedLevel, setUnlockedLevel] = useState<1 | 2 | 3>(initialLevel);
  const [run, setRun] = useState(() => createRun(initialLevel));
  const [screen, setScreen] = useState<"playing" | "won" | "gameover">(
    "playing",
  );
  const [currentQ, setCurrentQ] = useState<TrailQuestion>(() => run.firstQ);
  const [eggsCollected, setEggsCollected] = useState(0);
  const [answer, setAnswer] = useState("");
  const [subAnswers, setSubAnswers] = useState<[string, string, string]>([
    "",
    "",
    "",
  ]);
  const [subStep, setSubStep] = useState(0); // Level 3: which step (0/1/2) is active
  const [posKm, setPosKm] = useState(0);
  const [minKm, setMinKm] = useState(0);
  const [maxKm, setMaxKm] = useState(0);
  const [odomKm, setOdomKm] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [facingLeft, setFacingLeft] = useState(false);
  const [soundMuted, setSoundMuted] = useState(() => isMuted());
  const [topPanel, setTopPanel] = useState<"map" | "question">("map");
  const [flash, setFlash] = useState<{
    text: string;
    ok: boolean;
    icon?: boolean;
  } | null>(null);
  const [gamePhase, setGamePhase] = useState<"normal" | "monster">("normal");
  const [monsterEggs, setMonsterEggs] = useState(0);
  const [monsterRoundName, setMonsterRoundName] = useState("");
  const [showMonsterAnnounce, setShowMonsterAnnounce] = useState(false);
  const [showShareDrawer, setShowShareDrawer] = useState(false);
  const [showCommentsDrawer, setShowCommentsDrawer] = useState(false);
  const [hasDiscoveredDinoDrag, setHasDiscoveredDinoDrag] = useState(false);
  const [hasDiscoveredKeypadDisplay, setHasDiscoveredKeypadDisplay] =
    useState(false);
  const [hasDiscoveredMonsterKeypadDisplay, setHasDiscoveredMonsterKeypadDisplay] =
    useState(false);
  /** After first wrong in L3 Extinction Event, show full 3-step scaffold + dino. */
  const [extinctionL3ShowSteps, setExtinctionL3ShowSteps] = useState(false);
  /** After a wrong direct-calculation attempt, finish the scaffold without earning that egg back. */
  const [extinctionL3RecoveryMode, setExtinctionL3RecoveryMode] =
    useState(false);
  const [calcRoundKey, setCalcRoundKey] = useState(0);
  const [isKeypadMinimized, setIsKeypadMinimized] = useState(false);

  const isMobileLandscape = useIsMobileLandscape();
  const isSmallMobileLandscape = useIsSmallMobileLandscape();
  const isCoarsePointer = useIsCoarsePointer();
  const isMobileLandscapeRef = useRef(isMobileLandscape);
  const keypadToggleRef = useRef<(() => void) | null>(null);
  const keypadMinimizeRef = useRef<(() => void) | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const floatingOdometerRef = useRef<HTMLButtonElement>(null);
  const landscapeOdometerRef = useRef<HTMLButtonElement>(null);
  const topBarRef = useRef<HTMLDivElement>(null);
  const steppedPromptScrollRef = useRef<HTMLDivElement>(null);
  const steppedPromptItemRefs = useRef<Array<HTMLDivElement | null>>([]);
  const leftControlsRef = useRef<HTMLDivElement>(null);
  const centerControlsRef = useRef<HTMLDivElement>(null);
  const rightControlsRef = useRef<HTMLDivElement>(null);
  const [odometerMapPos, setOdometerMapPos] = useState<{
    left: number;
    top: number;
    anchor: "above" | "right" | "left";
  } | null>(null);
  const [mobileLandscapeOdometerPos, setMobileLandscapeOdometerPos] = useState<{
    left: number;
    top: number;
  } | null>(null);
  const draggingRef = useRef(false);
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
  isMobileLandscapeRef.current = isMobileLandscape;
  const token = posAtKm(config, posKm, checkpoints);
  const routeStops = new Set(currentQ.route.map((i) => config.stops[i].id));
  const stopLabels = useMemo(
    () => config.stops.map((s) => s.label),
    [config.id],
  );

  /** Level 3 Monster rounds: start on final line only, no dino; after a wrong answer, reveal steps + dino. */
  const isL3MonsterRound = level === 3 && gamePhase === "monster";
  const l3ExtinctionSingleLineOnly = isL3MonsterRound && !extinctionL3ShowSteps;
  const l3ExtinctionRevealedScaffold =
    isL3MonsterRound && extinctionL3ShowSteps;
  const showDinoDragHint =
    !hasDiscoveredDinoDrag &&
    level === 1 &&
    gamePhase === "normal" &&
    eggsCollected === 0 &&
    screen === "playing" &&
    !showMonsterAnnounce;
  const showKeypadDisplayHint =
    hasDiscoveredDinoDrag &&
    !hasDiscoveredKeypadDisplay &&
    level === 1 &&
    gamePhase === "normal" &&
    eggsCollected === 0 &&
    screen === "playing" &&
    !dragging &&
    !showMonsterAnnounce;
  const showMonsterKeypadDisplayHint =
    level === 1 &&
    gamePhase === "monster" &&
    monsterEggs === 0 &&
    screen === "playing" &&
    !showMonsterAnnounce &&
    !hasDiscoveredMonsterKeypadDisplay;
  const tutorialHandScale = isCoarsePointer ? 1.5 : 1.125;
  const tutorialHandOffsetX = isCoarsePointer ? 5 : 20;
  const tutorialHandOffsetY = isCoarsePointer ? -40 : -25;
  const tutorialDragHintLabel = isCoarsePointer ? "Touch and Drag" : "Click and Drag";
  const tutorialDragHintFontSize = isCoarsePointer ? 21 : 26;
  const tutorialDragHintBoxWidth = isCoarsePointer ? 248 : 300;
  const tutorialDragHintBoxHeight = isCoarsePointer ? 28 : 34;
  const hintRouteStart = config.stops[currentQ.route[0]];
  const hintRouteNext =
    config.stops[currentQ.route[Math.min(1, currentQ.route.length - 1)]];
  const dinoHintDx = hintRouteNext.x - hintRouteStart.x;
  const dinoHintDy = hintRouteNext.y - hintRouteStart.y;

  // Tight viewBox so the trail fills the full map area on every screen ratio
  const xs = config.stops.map((s) => s.x);
  const ys = config.stops.map((s) => s.y);
  const padTop = 115; // room for dino sprite above node
  const padBottom = isMobileLandscape ? 72 : 60; // room for stop labels below node
  const padSide = 80; // room for label text either side
  const vbX = Math.min(...xs) - padSide;
  const vbY = Math.min(...ys) - padTop;
  const vbW = Math.max(...xs) - Math.min(...xs) + padSide * 2;
  const vbH = Math.max(...ys) - Math.min(...ys) + padTop + padBottom;
  const tightViewBox = `${vbX} ${vbY} ${vbW} ${vbH}`;

  // Odometer HTML overlay: same trail math as dino; SVG anchor just above the sprite (see RexSprite).
  useLayoutEffect(() => {
    const mapEl = mapContainerRef.current;
    if (!svgRef.current || !mapEl) return;

    function commit() {
      const svg = svgRef.current;
      const map = mapContainerRef.current;
      if (!svg || !map) return;
      // pAbove: anchor point used when odometer floats above the dino
      const pAbove = svgUserToMapLocal(svg, map, token.x, token.y - 152);
      if (!pAbove) return;

      if (!isMobileLandscapeRef.current) {
        const edgePad = 88;
        const clampedLeft = clamp(
          pAbove.left,
          edgePad,
          map.clientWidth - edgePad,
        );
        setOdometerMapPos({
          left: clampedLeft,
          top: pAbove.top - 12,
          anchor: "above",
        });
        return;
      }

      // Mobile landscape: compute dino x fraction to pick anchor zone
      const pBase = svgUserToMapLocal(svg, map, token.x, token.y); // dino foot
      const pCenter = svgUserToMapLocal(svg, map, token.x, token.y - 94); // dino vertical centre
      if (!pBase || !pCenter) return;

      const frac = pBase.left / map.clientWidth;
      // On mobile landscape the odometer is always side-anchored — never above
      // (avoids going off-screen vertically in the centre of the trail).
      const anchor: "above" | "right" | "left" = frac < 0.5 ? "right" : "left";
      setOdometerMapPos({ left: pCenter.left, top: pCenter.top, anchor });
    }

    commit();
    const raf = requestAnimationFrame(commit);
    const ro = new ResizeObserver(commit);
    ro.observe(mapEl);
    window.addEventListener("resize", commit);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("resize", commit);
    };
  }, [token.x, token.y, tightViewBox]);

  useLayoutEffect(() => {
    if (!isMobileLandscape) {
      setMobileLandscapeOdometerPos(null);
      return;
    }

    const topBar = topBarRef.current;
    const centerControls = centerControlsRef.current;
    const rightControls = rightControlsRef.current;
    if (!topBar || !centerControls || !rightControls) return;

    function commit() {
      if (!topBar || !centerControls || !rightControls) return;
      const barRect = topBar.getBoundingClientRect();
      const centerRect = centerControls.getBoundingClientRect();
      const rightRect = rightControls.getBoundingClientRect();
      const gapLeft = centerRect.right - barRect.left;
      const gapRight = rightRect.left - barRect.left;
      const left = gapLeft + Math.max(0, gapRight - gapLeft) / 2;
      const top = rightRect.top - barRect.top;
      setMobileLandscapeOdometerPos({ left, top });
    }

    commit();
    const raf = requestAnimationFrame(commit);
    const ro = new ResizeObserver(commit);
    ro.observe(topBar);
    ro.observe(centerControls);
    ro.observe(rightControls);
    window.addEventListener("resize", commit);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("resize", commit);
    };
  }, [
    isMobileLandscape,
    screen,
    gamePhase,
    showMonsterAnnounce,
    currentQ.totalGiven,
    odomKm,
  ]);

  useEffect(() => {
    startMusic();
    setSoundMuted(isMuted());
    // Teleport dino to the first question's start stop on initial load
    const firstStartKm = getCheckpoints(run.config)[run.firstQ.route[0]];
    setFacingLeft(shouldFaceLeftForRoute(run.firstQ.route));
    posKmRef.current = firstStartKm;
    minKmRef.current = firstStartKm;
    maxKmRef.current = firstStartKm;
    odometerRef.current = 0;
    lastStepRef.current = -0.35;
    setPosKm(firstStartKm);
    setMinKm(firstStartKm);
    setMaxKm(firstStartKm);
    setOdomKm(0);
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const ae = document.activeElement as HTMLElement | null;
      if (
        ae &&
        (ae.tagName === "INPUT" ||
          ae.tagName === "TEXTAREA" ||
          ae.isContentEditable)
      )
        return;

      const k = e.key;
      const code = e.code;

      if (k === "Enter" || code === "NumpadEnter") {
        e.preventDefault();
        submitAnswerRef.current();
        return;
      }

      const val = keypadValueRef.current;
      let next: string;

      const digit = digitFromKeyCode(code);
      if (digit) {
        e.preventDefault();
        next = val === "0" ? digit : `${val}${digit}`;
        playKeyClick();
        handleKeypadChangeRef.current(next);
        return;
      }

      if (code === "Backspace" || k === "Backspace") {
        e.preventDefault();
        playKeyClick();
        handleKeypadChangeRef.current(val.slice(0, -1));
        return;
      }

      if (code === "Minus" || code === "NumpadSubtract" || k === "-") {
        e.preventDefault();
        if (val.startsWith("-")) next = val.slice(1);
        else if (val !== "" && val !== "0") next = `-${val}`;
        else return;
        playKeyClick();
        handleKeypadChangeRef.current(next);
        return;
      }

      if (
        code === "Period" ||
        code === "NumpadDecimal" ||
        k === "." ||
        k === ","
      ) {
        e.preventDefault();
        if (val.includes(".")) return;
        next = val === "" ? "0." : `${val}.`;
        playKeyClick();
        handleKeypadChangeRef.current(next);
        return;
      }

      // Fallback when `code` is missing or nonstandard (some embedded browsers)
      if (/^[0-9]$/.test(k)) {
        e.preventDefault();
        next = val === "0" ? k : `${val}${k}`;
        playKeyClick();
        handleKeypadChangeRef.current(next);
      }
    }

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);

  // ── Reliable native pointer drag listeners (bypasses React synthetic event quirks) ──
  // Runs once; uses refs so the closure is always reading the latest values.
  useEffect(() => {
    function onPointerMove(e: PointerEvent) {
      if (!draggingRef.current || !svgRef.current) return;
      const { x, y } = toSVGPoint(svgRef.current, e.clientX, e.clientY);
      moveRexRef.current(
        projectToTrail(configRef.current, x, y, checkpointsRef.current),
      );
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

  const moveRex = useCallback(
    (nextKm: number) => {
      const { edges } = run.config;
      const cp = getCheckpoints(run.config);
      let clamped = clamp(nextKm, 0, totalKm(run.config));

      // Snap to nearest node km to kill odometer jitter.
      // Each node's snap zone = 15% of its shorter adjacent edge, so zones
      // can never overlap even on the shortest edge (15%+15% = 30% < 100%).
      for (let ci = 0; ci < cp.length; ci++) {
        const edgeBefore = ci > 0 ? edges[ci - 1].distance : Infinity;
        const edgeAfter = ci < edges.length ? edges[ci].distance : Infinity;
        const snapKm = Math.min(edgeBefore, edgeAfter) * 0.15;
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
    },
    [run.config],
  );

  // Keep moveRexRef pointing at the latest moveRex (stable within a run).
  moveRexRef.current = moveRex;
  // Keep gamePhaseRef in sync so the window pointer listener always sees current phase.
  gamePhaseRef.current = gamePhase;

  function startDrag(e: React.PointerEvent) {
    e.preventDefault();
    if (!hasDiscoveredDinoDrag) setHasDiscoveredDinoDrag(true);
    // Capture pointer on the SVG so pointermove events keep firing even when
    // the finger drifts off the dino — window listener above handles the moves.
    svgRef.current?.setPointerCapture(e.pointerId);
    draggingRef.current = true;
    setDragging(true);
    // Kick off position update immediately on first touch/click.
    if (svgRef.current) {
      const { x, y } = toSVGPoint(svgRef.current, e.clientX, e.clientY);
      moveRexRef.current(
        projectToTrail(configRef.current, x, y, checkpointsRef.current),
      );
    }
  }

  function resetPosition(startKm = 0) {
    posKmRef.current = startKm;
    minKmRef.current = startKm;
    maxKmRef.current = startKm;
    odometerRef.current = 0;
    lastStepRef.current = -0.35;
    setPosKm(startKm);
    setMinKm(startKm);
    setMaxKm(startKm);
    setOdomKm(0);
    setAnswer("");
    setSubAnswers(["", "", ""]);
    setSubStep(0);
  }

  function resetOdometer() {
    playButton();
    odometerRef.current = 0;
    lastStepRef.current = -0.35;
    setOdomKm(0);
  }

  function handleToggleMute() {
    const nowMuted = toggleMute();
    setSoundMuted(nowMuted);
  }

  async function toggleShareDrawer() {
    setShowCommentsDrawer(false);

    const nav = navigator as Navigator & {
      share?: (data: ShareData) => Promise<void>;
      canShare?: (data?: ShareData) => boolean;
      standalone?: boolean;
    };
    const shareData: ShareData = {
      title: document.title || "Trail Distances",
      text: "Check out this maths game on Interactive Maths!",
      url: "https://interactive-maths.vercel.app/",
    };
    const looksMobileOrPwa =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      !!nav.standalone ||
      navigator.maxTouchPoints > 0;

    if (
      looksMobileOrPwa &&
      typeof nav.share === "function" &&
      (!nav.canShare || nav.canShare(shareData))
    ) {
      try {
        await nav.share(shareData);
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
      }
    }

    setShowShareDrawer((open) => !open);
  }

  function toggleCommentsDrawer() {
    setShowCommentsDrawer((open) => {
      const next = !open;
      if (next) setShowShareDrawer(false);
      return next;
    });
  }

  function closeSocialDrawers() {
    setShowShareDrawer(false);
    setShowCommentsDrawer(false);
  }

  async function handleCaptureQuestion() {
    if (!IS_LOCALHOST_DEV) return;
    const svg = svgRef.current;
    const map = mapContainerRef.current;
    if (!svg || !map) {
      showFlash("Capture failed", false);
      return;
    }

    try {
      if (typeof document !== "undefined" && "fonts" in document) {
        await document.fonts.ready;
      }

      const rect = map.getBoundingClientRect();
      const width = Math.max(1, Math.ceil(rect.width));
      const height = Math.max(1, Math.ceil(rect.height));
      const clone = svg.cloneNode(true) as SVGSVGElement;
      clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
      clone.setAttribute("width", String(width));
      clone.setAttribute("height", String(height));
      clone.setAttribute("viewBox", tightViewBox);

      const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      bg.setAttribute("x", String(vbX));
      bg.setAttribute("y", String(vbY));
      bg.setAttribute("width", String(vbW));
      bg.setAttribute("height", String(vbH));
      bg.setAttribute("fill", phaseBg.bg);
      clone.insertBefore(bg, clone.firstChild);

      const defs =
        clone.querySelector("defs") ??
        clone.insertBefore(
          document.createElementNS("http://www.w3.org/2000/svg", "defs"),
          clone.firstChild,
        );
      const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
      const regularFontUrl = await toDataUrl(
        new URL(dsegRegularWoff2Url, window.location.href).href,
        "font/woff2",
      );
      const boldFontUrl = await toDataUrl(
        new URL(dsegBoldWoff2Url, window.location.href).href,
        "font/woff2",
      );
      style.textContent = `
        @font-face {
          font-family: 'DSEG7Classic';
          src: url('${regularFontUrl}') format('woff2');
          font-weight: 400;
          font-style: normal;
        }
        @font-face {
          font-family: 'DSEG7Classic';
          src: url('${boldFontUrl}') format('woff2');
          font-weight: 700;
          font-style: normal;
        }
        text {
          font-family: 'Courier New', 'Lucida Console', monospace;
          letter-spacing: 0.06em;
        }
      `;
      defs.appendChild(style);

      const svgText = new XMLSerializer().serializeToString(clone);
      const blob = new Blob([svgText], {
        type: "image/svg+xml;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);

      const img = new Image();
      const pngBlob = await new Promise<Blob>((resolve, reject) => {
        img.onload = () => {
          const scale = 2;
          const canvas = document.createElement("canvas");
          canvas.width = width * scale;
          canvas.height = height * scale;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            reject(new Error("Canvas context unavailable"));
            return;
          }
          ctx.setTransform(scale, 0, 0, scale, 0, 0);
          ctx.drawImage(img, 0, 0, width, height);

          const odometerEl = isMobileLandscape
            ? landscapeOdometerRef.current
            : floatingOdometerRef.current;
          if (odometerEl && screen === "playing" && gamePhase === "normal" && !showMonsterAnnounce) {
            const mapRect = map.getBoundingClientRect();
            const odometerRect = odometerEl.getBoundingClientRect();
            const x = odometerRect.left - mapRect.left;
            const y = odometerRect.top - mapRect.top;
            const withinCapture =
              odometerRect.right > mapRect.left &&
              odometerRect.left < mapRect.right &&
              odometerRect.bottom > mapRect.top &&
              odometerRect.top < mapRect.bottom;

            if (withinCapture) {
              const panelX = Math.max(0, x);
              const panelY = Math.max(0, y);
              const panelW = Math.min(width - panelX, odometerRect.width);
              const panelH = Math.min(height - panelY, odometerRect.height);

              if (panelW > 0 && panelH > 0) {
                ctx.save();
                addRoundedRectPath(ctx, panelX, panelY, panelW, panelH, 16);
                ctx.fillStyle = "rgba(2, 6, 23, 0.92)";
                ctx.fill();
                ctx.lineWidth = 4;
                ctx.strokeStyle = "rgba(125, 211, 252, 0.9)";
                ctx.stroke();

                ctx.shadowColor = "rgba(56, 189, 248, 0.22)";
                ctx.shadowBlur = 24;
                ctx.strokeStyle = "rgba(56, 189, 248, 0.15)";
                ctx.stroke();
                ctx.shadowColor = "transparent";

                const mainValue = odomKm.toFixed(1);
                const secondaryValue =
                  currentQ.totalGiven != null
                    ? `Σ ${currentQ.totalGiven.toFixed(1)} ${config.unit}`
                    : null;

                ctx.fillStyle = "#ffffff";
                ctx.textAlign = "right";
                ctx.textBaseline = "top";
                ctx.font = `700 ${KEYPAD_DISPLAY_FONT_SIZE} 'DSEG7Classic', 'Courier New', monospace`;
                ctx.fillText(mainValue, panelX + panelW - 12, panelY + 10);

                if (secondaryValue) {
                  ctx.fillStyle = "#fde047";
                  ctx.textAlign = "center";
                  ctx.font = "900 16px 'Courier New', 'Lucida Console', monospace";
                  ctx.fillText(secondaryValue, panelX + panelW / 2, panelY + panelH - 24);
                }
                ctx.restore();
              }
            }
          }

          canvas.toBlob((blobOut) => {
            if (!blobOut) {
              reject(new Error("Unable to encode PNG"));
              return;
            }
            resolve(blobOut);
          }, "image/png");
        };
        img.onerror = () => reject(new Error("Unable to render scene snapshot"));
        img.src = url;
      });
      URL.revokeObjectURL(url);

      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const fileName = `distance-scene-${stamp}.png`;
      const nav = navigator as Navigator & {
        share?: (data: ShareData) => Promise<void>;
        canShare?: (data?: ShareData) => boolean;
        standalone?: boolean;
      };
      const file = new File([pngBlob], fileName, { type: "image/png" });
      const shareData: ShareData = {
        files: [file],
        title: "Distance Calculator scene",
        text: "Save or share this Distance Calculator scene.",
      };
      const looksMobileOrPwa =
        window.matchMedia?.("(display-mode: standalone)").matches ||
        !!nav.standalone ||
        navigator.maxTouchPoints > 0;

      if (
        looksMobileOrPwa &&
        typeof nav.share === "function" &&
        (!nav.canShare || nav.canShare(shareData))
      ) {
        try {
          await nav.share(shareData);
          showFlash("Image ready to share", true);
          return;
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") {
            return;
          }
        }
      }

      const pngUrl = URL.createObjectURL(pngBlob);
      const link = document.createElement("a");
      link.href = pngUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(pngUrl);
      showFlash("Scene captured", true);
    } catch (error) {
      console.error("Scene capture failed", error);
      showFlash("Capture failed", false);
    }
  }

  function resetCurrentQuestion() {
    playButton();
    setFlash(null);
    setDragging(false);
    setFacingLeft(shouldFaceLeftForRoute(currentQ.route));
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
    setExtinctionL3ShowSteps(false);
    setExtinctionL3RecoveryMode(false);
    setGamePhase("normal");
    setFlash(null);
    setDragging(false);
    setFacingLeft(shouldFaceLeftForRoute(next.firstQ.route));
    const firstStartKm = getCheckpoints(next.config)[next.firstQ.route[0]];
    resetPosition(firstStartKm);
    setCalcRoundKey((k) => k + 1);
  }

  /** DEV ONLY: jump straight to having i+1 eggs on the current level/phase. */
  function devSetEggs(i: number) {
    if (!IS_DEV) return;
    const target = i + 1;
    if (gamePhase === "monster") {
      if (target === EGGS_PER_LEVEL) {
        earnMonsterEgg();
      } else if (target > monsterEggs) {
        setMonsterEggs(target);
        playGoldenEgg();
        advanceMonsterQuestionWithoutEgg();
      } else {
        setMonsterEggs(target);
      }
      return;
    }
    if (target === EGGS_PER_LEVEL) {
      setEggsCollected(EGGS_PER_LEVEL);
      startMonsterRound();
    } else {
      setEggsCollected(target);
      const next = createRun(level);
      setRun(next);
      setCurrentQ(next.firstQ);
      setFacingLeft(shouldFaceLeftForRoute(next.firstQ.route));
      resetPosition(getCheckpoints(next.config)[next.firstQ.route[0]]);
    }
  }

  function startMonsterRound() {
    const name =
      MONSTER_ROUND_NAMES[
        Math.floor(Math.random() * MONSTER_ROUND_NAMES.length)
      ];
    setMonsterRoundName(name);
    setExtinctionL3ShowSteps(false);
    setExtinctionL3RecoveryMode(false);
    setGamePhase("monster");
    setMonsterEggs(0);
    setShowMonsterAnnounce(true);
    playMonsterStart();
    switchToMonsterMusic();
    // Fresh run so the child gets a new map to think through without the odometer
    const next = createRun(level);
    setRun(next);
    setCurrentQ(next.firstQ);
    setFacingLeft(shouldFaceLeftForRoute(next.firstQ.route));
    setSubAnswers(["", "", ""]);
    setSubStep(0);
    const startKm = getCheckpoints(next.config)[next.firstQ.route[0]];
    resetPosition(startKm);
    window.setTimeout(() => setShowMonsterAnnounce(false), 4200);
    setCalcRoundKey((k) => k + 1);
  }

  function queueNextQuestionAfterSuccessIcon(onComplete: () => void) {
    setFlash({ text: "", ok: true, icon: true });
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = window.setTimeout(() => {
      setFlash(null);
      onComplete();
    }, SUCCESS_ICON_DURATION_MS);
  }

  function earnMonsterEgg() {
    const newGolden = monsterEggs + 1;
    if (newGolden === EGGS_PER_LEVEL) {
      setMonsterEggs(EGGS_PER_LEVEL);
      if (level === 3) {
        // All levels complete — grand finale
        playGameComplete();
        setScreen("gameover");
      } else {
        playMonsterVictory();
        if (!IS_DEV)
          setUnlockedLevel((u) => Math.max(u, level + 1) as 1 | 2 | 3);
        // gamePhase stays "monster" so won screen shows the right message
        setScreen("won");
      }
      return;
    }
    setMonsterEggs(newGolden);
    playGoldenEgg();
    queueNextQuestionAfterSuccessIcon(() => {
      const next = createRun(level);
      setRun(next);
      setCurrentQ(next.firstQ);
      setFacingLeft(shouldFaceLeftForRoute(next.firstQ.route));
      resetPosition(getCheckpoints(next.config)[next.firstQ.route[0]]);
      // Next Extinction Event question starts on final line only (until another miss).
      setExtinctionL3ShowSteps(false);
      setExtinctionL3RecoveryMode(false);
      setCalcRoundKey((k) => k + 1);
    });
  }

  function advanceMonsterQuestionWithoutEgg() {
    queueNextQuestionAfterSuccessIcon(() => {
      const next = createRun(level);
      setRun(next);
      setCurrentQ(next.firstQ);
      setFacingLeft(shouldFaceLeftForRoute(next.firstQ.route));
      resetPosition(getCheckpoints(next.config)[next.firstQ.route[0]]);
      setExtinctionL3ShowSteps(false);
      setExtinctionL3RecoveryMode(false);
      setCalcRoundKey((k) => k + 1);
    });
  }

  function showFlash(text: string, ok: boolean) {
    setFlash({ text, ok });
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = window.setTimeout(() => setFlash(null), 1600);
  }

  function earnEgg() {
    const newEggs = eggsCollected + 1;
    if (newEggs === EGGS_PER_LEVEL) {
      setEggsCollected(EGGS_PER_LEVEL);
      // Trigger Monster Round instead of going straight to the won screen
      startMonsterRound();
      return;
    }
    setEggsCollected(newEggs);
    queueNextQuestionAfterSuccessIcon(() => {
      const next = createRun(level);
      setRun(next);
      setCurrentQ(next.firstQ);
      setFacingLeft(shouldFaceLeftForRoute(next.firstQ.route));
      resetPosition(getCheckpoints(next.config)[next.firstQ.route[0]]);
      setExtinctionL3RecoveryMode(false);
      setCalcRoundKey((k) => k + 1);
    });
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
    if (level === 3 && gamePhase === "monster") {
      setExtinctionL3ShowSteps(true);
      setExtinctionL3RecoveryMode(true);
      resetPosition(getCheckpoints(config)[currentQ.route[0]]);
      setCalcRoundKey((k) => k + 1);
      return;
    }
    setFacingLeft(shouldFaceLeftForRoute(currentQ.route));
    resetPosition(getCheckpoints(config)[currentQ.route[0]]);
    setExtinctionL3RecoveryMode(false);
    setCalcRoundKey((k) => k + 1);
  }

  function submitAnswer() {
    playButton();

    // ── Level 3: stepped one-at-a-time ──
    if (currentQ.subAnswers && currentQ.promptLines) {
      if (l3ExtinctionSingleLineOnly) {
        const g = parseFloat(subAnswers[2]);
        if (isNaN(g)) {
          showFlash("Enter a number!", false);
          return;
        }
        if (isMobileLandscape) keypadMinimizeRef.current?.();
        const ok = Math.abs(g - currentQ.subAnswers[2]) < 0.11;
        if (ok) {
          playCorrect();
          earnMonsterEgg();
        } else {
          loseEgg();
        }
        return;
      }

      const g = parseFloat(subAnswers[subStep]);
      if (isNaN(g)) {
        showFlash("Enter a number!", false);
        return;
      }
      if (isMobileLandscape) keypadMinimizeRef.current?.();
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
      if (ok) {
        playCorrect();
        if (extinctionL3RecoveryMode && gamePhase === "monster")
          advanceMonsterQuestionWithoutEgg();
        else gamePhase === "monster" ? earnMonsterEgg() : earnEgg();
      } else {
        loseEgg();
      }
      return;
    }

    // ── Level 1 / 2 ──
    const guess = parseFloat(answer);
    if (isNaN(guess)) {
      showFlash("Type a number!", false);
      return;
    }
    if (isMobileLandscape) keypadMinimizeRef.current?.();
    const correct = Math.abs(guess - currentQ.answer) < 0.11;
    if (correct) {
      playCorrect();
      gamePhase === "monster" ? earnMonsterEgg() : earnEgg();
    } else {
      loseEgg();
    }
  }

  function handleKeypadChange(v: string) {
    if (showKeypadDisplayHint) {
      setHasDiscoveredKeypadDisplay(true);
    }
    if (showMonsterKeypadDisplayHint) {
      setHasDiscoveredMonsterKeypadDisplay(true);
    }
    if (currentQ.subAnswers && currentQ.promptLines) {
      const idx = l3ExtinctionSingleLineOnly ? 2 : subStep;
      setSubAnswers((prev) => {
        const next = [...prev] as [string, string, string];
        next[idx] = v;
        return next;
      });
      return;
    }

    setAnswer(v);
  }

  const pal = config.palette;
  const phaseBg = PHASE_BG[`${level}-${gamePhase}`] ?? {
    bg: pal.bg,
    glow: pal.bgGlow,
    tint: "transparent",
  };
  const edgeLabelFontSize = isMobileLandscape ? 26 : 27; // 1.25 × station name font (21)
  const isSocialDrawerOpen = showShareDrawer || showCommentsDrawer;
  const l3KeypadIndex =
    currentQ.promptLines && currentQ.subAnswers
      ? l3ExtinctionSingleLineOnly
        ? 2
        : subStep
      : null;
  const keypadValue =
    l3KeypadIndex !== null ? subAnswers[l3KeypadIndex] : answer;
  const canKeypadSubmit =
    l3KeypadIndex !== null
      ? !isNaN(parseFloat(subAnswers[l3KeypadIndex]))
      : !isNaN(parseFloat(answer));
  const isFullScreenOverlayActive =
    showMonsterAnnounce || screen === "won" || screen === "gameover";
  useEffect(() => {
    if (typeof window === "undefined" || window.parent === window) return;
    window.parent.postMessage(
      { type: "interactive-maths:overlay-active", active: isSocialDrawerOpen || isFullScreenOverlayActive },
      "*",
    );
  }, [isFullScreenOverlayActive, isSocialDrawerOpen]);
  const isCompactQuestionTray = isMobileLandscape;
  const useCollapsedQuestionTray = isCompactQuestionTray && isKeypadMinimized;
  const collapsedPromptPanelClass = useCollapsedQuestionTray
    ? "h-[78px] overflow-y-auto py-1 leading-[1.25rem]"
    : isMobileLandscape
      ? "min-h-[52px] py-1.5"
      : "min-h-[60px] py-2";
  const collapsedStepPanelClass = useCollapsedQuestionTray
    ? "py-1"
    : "py-2.5";
  keypadValueRef.current = keypadValue;
  handleKeypadChangeRef.current = handleKeypadChange;
  submitAnswerRef.current = submitAnswer;

  useEffect(() => {
    setIsKeypadMinimized(isCoarsePointer);
  }, [isCoarsePointer, calcRoundKey]);

  useEffect(() => {
    if (
      !isMobileLandscape ||
      !currentQ.promptLines ||
      !currentQ.subAnswers ||
      l3ExtinctionSingleLineOnly
    ) {
      return;
    }
    const container = steppedPromptScrollRef.current;
    const activeItem = steppedPromptItemRefs.current[subStep];
    if (!container || !activeItem) return;
    window.requestAnimationFrame(() => {
      activeItem.scrollIntoView({
        block: "nearest",
        inline: "nearest",
        behavior: "smooth",
      });
    });
  }, [
    isMobileLandscape,
    currentQ.promptLines,
    currentQ.subAnswers,
    l3ExtinctionSingleLineOnly,
    subStep,
  ]);

  return (
    <div
      className="relative w-screen overflow-hidden font-arcade"
      style={{
        height: "100dvh",
        minHeight: "100svh",
        background: `radial-gradient(ellipse at top, ${phaseBg.glow} 0%, ${phaseBg.bg} 72%)`,
      }}
    >
      <div className="pointer-events-none absolute inset-0 arcade-grid opacity-20" />
      {/* Monster Round atmospheric tint overlay */}
      {gamePhase === "monster" && (
        <div
          className="pointer-events-none absolute inset-0 z-[1]"
          style={{ background: phaseBg.tint }}
        />
      )}

      {/* ── top bar ── */}
      {!isFullScreenOverlayActive && (
        <div
          ref={topBarRef}
          className="absolute left-0 right-0 top-0 z-[45] flex items-start px-3 md:px-5"
          style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.5rem)" }}
        >
        {/* Left icon buttons — keep these horizontal so small iPhones match the newer top-row layout. */}
        <div
          ref={leftControlsRef}
          className="flex flex-row gap-1 mt-0 md:ml-[34px] shrink-0"
          style={isSmallMobileLandscape ? { marginLeft: "40px" } : undefined}
        >
          <button
            onClick={resetCurrentQuestion}
            title="Reset"
            className="arcade-button w-10 h-10 flex items-center justify-center p-2"
          >
            <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
              <path
                d="M1 4v6h6"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M23 20v-6h-6"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <button
            onClick={handleToggleMute}
            title={soundMuted ? "Unmute" : "Mute"}
            className="arcade-button w-10 h-10 flex items-center justify-center p-2"
            style={
              soundMuted
                ? {
                    background: "linear-gradient(180deg,#475569,#334155)",
                    boxShadow: "0 5px 0 #1e293b",
                    borderColor: "#94a3b8",
                  }
                : {}
            }
          >
            <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
              {soundMuted ? (
                <>
                  <polygon
                    points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"
                    fill="white"
                  />
                  <line
                    x1="23"
                    y1="9"
                    x2="17"
                    y2="15"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <line
                    x1="17"
                    y1="9"
                    x2="23"
                    y2="15"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </>
              ) : (
                <>
                  <polygon
                    points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"
                    fill="white"
                  />
                  <path
                    d="M15.54 8.46a5 5 0 0 1 0 7.07"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <path
                    d="M19.07 4.93a10 10 0 0 1 0 14.14"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </>
              )}
            </svg>
          </button>
          {IS_LOCALHOST_DEV && (
            <button
              type="button"
              onClick={handleCaptureQuestion}
              title="Capture scene"
              aria-label="Capture scene"
              className="social-launcher arcade-button"
            >
              <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
                <path
                  d="M7 7h2l1.2-2h3.6L15 7h2a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z"
                  stroke="white"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <circle
                  cx="12"
                  cy="12.5"
                  r="3.25"
                  stroke="white"
                  strokeWidth="1.9"
                />
              </svg>
            </button>
          )}
        </div>

        {/* Landscape-only static odometer — docked between left icons and center panel */}
        {isMobileLandscape &&
          mobileLandscapeOdometerPos &&
          screen === "playing" &&
          gamePhase === "normal" &&
          !showMonsterAnnounce && (
            <button
              ref={landscapeOdometerRef}
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                resetOdometer();
              }}
              title="Tap to reset"
              className="arcade-meter absolute z-[46] w-max cursor-pointer inline-flex flex-col items-stretch px-2 py-2 transition-transform active:scale-95"
              style={{
                left: mobileLandscapeOdometerPos.left,
                top: mobileLandscapeOdometerPos.top - 2,
                transform: "translateX(-50%)",
              }}
            >
              {currentQ.totalGiven != null ? (
                <>
                  <div className="flex w-full justify-end">
                    <div
                      className="digital-meter leading-none text-white"
                      style={{
                        width: ODOMETER_MAIN_WIDTH,
                        minWidth: ODOMETER_MAIN_WIDTH,
                        textAlign: "right",
                        fontSize: KEYPAD_DISPLAY_FONT_SIZE,
                        lineHeight: 1,
                      }}
                    >
                      {odomKm.toFixed(1)}
                    </div>
                  </div>
                  <div className="mt-2 w-full whitespace-nowrap text-center text-base leading-none text-yellow-300">
                    Σ {currentQ.totalGiven.toFixed(1)} {config.unit}
                  </div>
                </>
              ) : (
                <div
                  className="digital-meter leading-none text-white"
                  style={{
                    width: ODOMETER_MAIN_WIDTH,
                    minWidth: ODOMETER_MAIN_WIDTH,
                    textAlign: "right",
                    fontSize: KEYPAD_DISPLAY_FONT_SIZE,
                    lineHeight: 1,
                  }}
                >
                  {odomKm.toFixed(1)}
                </div>
              )}
            </button>
          )}

        {/* Center: levels + eggs */}
        <div
          ref={centerControlsRef}
          className={
            isMobileLandscape
              ? "absolute top-[4px] left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 pt-1"
              : "flex-1 flex flex-col items-center gap-1.5 pt-1"
          }
        >
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
                    background: locked
                      ? "#0f172a"
                      : level === lv
                        ? gamePhase === "monster"
                          ? "#92400e"
                          : "#0ea5e9"
                        : lv < level
                          ? "#78350f" // completed — dark gold
                          : "#1e293b",
                    borderColor: locked
                      ? "#1e293b"
                      : level === lv
                        ? gamePhase === "monster"
                          ? "#fbbf24"
                          : "#38bdf8"
                        : lv < level
                          ? "#fbbf24" // completed — gold border
                          : "#475569",
                    color: locked
                      ? "#334155"
                      : level === lv
                        ? gamePhase === "monster"
                          ? "#fde047"
                          : "white"
                        : lv < level
                          ? "#fde047" // completed — gold text
                          : "#64748b",
                    boxShadow:
                      lv < level ? "0 0 8px rgba(251,191,36,0.45)" : undefined,
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
            <div
              className="text-sm font-black uppercase tracking-widest px-3 py-1 rounded-full"
              style={{
                background:
                  "linear-gradient(135deg, rgba(161,122,6,0.85) 0%, rgba(202,138,4,0.9) 50%, rgba(161,122,6,0.85) 100%)",
                color: "#fef08a",
                border: "2px solid #fbbf24",
                boxShadow:
                  "0 0 12px rgba(251,191,36,0.6), 0 0 28px rgba(234,179,8,0.35), inset 0 1px 0 rgba(255,255,255,0.15)",
                textShadow: "0 0 10px rgba(250,204,21,0.9)",
                animation: "pulse 2s cubic-bezier(0.4,0,0.6,1) infinite",
              }}
            >
              ⚡ {monsterRoundName} ⚡
            </div>
          )}

          {/* 10-egg collector — two rows of five — sbed / game-icons.net / CC BY 3.0 */}
          <div
            className="flex flex-col gap-1 items-center"
            title={
              gamePhase === "monster"
                ? `${monsterEggs}/${EGGS_PER_LEVEL} golden eggs`
                : `${eggsCollected}/${EGGS_PER_LEVEL} eggs`
            }
          >
            {[0, 5].map((rowStart) => (
              <div
                key={rowStart}
                className="flex items-center justify-center gap-1 md:gap-1.5"
              >
                {EGG_INDICES.slice(rowStart, rowStart + 5).map((i) => {
                  const isMonster = gamePhase === "monster";
                  const count = isMonster ? monsterEggs : eggsCollected;
                  const collected = isMonster
                    ? i < monsterEggs
                    : i < eggsCollected;
                  const isNext = i === count && count < EGGS_PER_LEVEL;

                  let eggFill: string;
                  let eggStroke: string;
                  if (collected) {
                    eggFill = isMonster ? "#facc15" : "white";
                    eggStroke = isMonster ? "#fbbf24" : "white";
                  } else if (isNext) {
                    // Next egg to earn — grey (no dashed ring)
                    eggFill = isMonster
                      ? "#64748b"
                      : "rgba(148, 163, 184, 0.22)";
                    eggStroke = "#94a3b8";
                  } else {
                    eggFill = isMonster ? "white" : "transparent";
                    eggStroke = isMonster
                      ? "rgba(255,255,255,0.55)"
                      : "rgba(255,255,255,0.22)";
                  }

                  const eggGlow = collected
                    ? isMonster
                      ? "drop-shadow(0 0 6px rgba(250,204,21,0.95)) drop-shadow(0 0 14px rgba(251,191,36,0.6))"
                      : "drop-shadow(0 0 5px rgba(255,255,255,0.7))"
                    : "none";
                  return (
                    <button
                      key={i}
                      type="button"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={IS_DEV ? () => devSetEggs(i) : undefined}
                      title={
                        IS_DEV
                          ? `DEV: set to ${i + 1} egg${i + 1 > 1 ? "s" : ""}`
                          : undefined
                      }
                      style={{
                        display: "inline-flex",
                        cursor: IS_DEV ? "pointer" : "default",
                        background: "transparent",
                        border: "none",
                        padding: 0,
                      }}
                    >
                      <svg
                        viewBox="0 0 512 512"
                        width="18"
                        height="18"
                        className="md:w-5 md:h-5"
                        style={{ filter: eggGlow, transition: "all 0.35s" }}
                      >
                        <path
                          d="M256 16C166 16 76 196 76 316c0 90 60 180 180 180s180-90 180-180c0-120-90-300-180-300z"
                          fill={eggFill}
                          stroke={eggStroke}
                          strokeWidth="18"
                        />
                        {(collected || isMonster) && (
                          <ellipse
                            cx="190"
                            cy="150"
                            rx="35"
                            ry="60"
                            fill={
                              isMonster && collected
                                ? "#fef08a"
                                : isNext
                                  ? "#cbd5e1"
                                  : "white"
                            }
                            opacity={
                              isMonster && collected
                                ? 0.35
                                : isNext
                                  ? 0.22
                                  : isMonster && !collected
                                    ? 0.18
                                    : 0.35
                            }
                            transform="rotate(-20 190 150)"
                          />
                        )}
                      </svg>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        </div>
      )}

      {/* ── map ── */}
      <div
        ref={mapContainerRef}
        className={`absolute inset-x-0 top-[184px] bottom-[86px] md:top-[88px] md:bottom-[128px] ${topPanel === "map" ? "z-40" : "z-20"}`}
        style={isMobileLandscape ? { top: 64, bottom: 88 } : undefined}
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
            const edgeEnd = checkpoints[i + 1];

            // Visited range is [minKm, maxKm] — extends in BOTH directions from the
            // start so backward routes (e.g. A→C where C is left of A) are colored.
            // minKm starts at routeStartKm and only decreases; maxKm only increases.
            const visitedFromT = clamp(
              (minKm - edgeStart) / edge.distance,
              0,
              1,
            );
            const visitedToT = clamp((maxKm - edgeStart) / edge.distance, 0, 1);
            const visitedFromPt = {
              x: A.x + (B.x - A.x) * visitedFromT,
              y: A.y + (B.y - A.y) * visitedFromT,
            };
            const visitedToPt = {
              x: A.x + (B.x - A.x) * visitedToT,
              y: A.y + (B.y - A.y) * visitedToT,
            };
            const showVisited = visitedToT > visitedFromT + 0.001;

            // Repeat overlay: dino went forward and has come back (posKm < maxKm).
            const repFromT = clamp((posKm - edgeStart) / edge.distance, 0, 1);
            const repFromPt = {
              x: A.x + (B.x - A.x) * repFromT,
              y: A.y + (B.y - A.y) * repFromT,
            };
            const showRepeat =
              maxKm > posKm + 0.05 && visitedToT > repFromT + 0.001;

            const mx = (A.x + B.x) / 2;
            const myCentre = (A.y + B.y) / 2; // true midpoint on the track
            const my = myCentre - 28; // label above track (normal edges)
            const isHidden = currentQ.hiddenEdge === i;
            void edgeEnd;

            // Is this edge part of the current question's route?
            const isRouteEdge =
              routeStops.has(config.stops[i].id) &&
              routeStops.has(config.stops[i + 1].id);

            return (
              <g key={edge.from}>
                {/* dark unlit road */}
                <line
                  x1={A.x}
                  y1={A.y}
                  x2={B.x}
                  y2={B.y}
                  stroke="rgba(0,0,0,0.5)"
                  strokeWidth={26}
                  strokeLinecap="round"
                />
                <line
                  x1={A.x}
                  y1={A.y}
                  x2={B.x}
                  y2={B.y}
                  stroke="#1a2a3a"
                  strokeWidth={20}
                  strokeLinecap="round"
                />
                {/* faint route highlight — so player knows the question path */}
                {isRouteEdge && (
                  <line
                    x1={A.x}
                    y1={A.y}
                    x2={B.x}
                    y2={B.y}
                    stroke={pal.trail}
                    strokeWidth={10}
                    strokeLinecap="round"
                    opacity={0.18}
                  />
                )}
                {showVisited && (
                  <line
                    x1={visitedFromPt.x}
                    y1={visitedFromPt.y}
                    x2={visitedToPt.x}
                    y2={visitedToPt.y}
                    stroke={pal.visited}
                    strokeWidth={10}
                    strokeLinecap="round"
                  />
                )}
                {showRepeat && (
                  <>
                    {/* backward track — wider base + bright centre stripe to look distinct */}
                    <line
                      x1={repFromPt.x}
                      y1={repFromPt.y}
                      x2={visitedToPt.x}
                      y2={visitedToPt.y}
                      stroke={pal.repeated}
                      strokeWidth={13}
                      strokeLinecap="round"
                      opacity={0.7}
                    />
                    <line
                      x1={repFromPt.x}
                      y1={repFromPt.y}
                      x2={visitedToPt.x}
                      y2={visitedToPt.y}
                      stroke="white"
                      strokeWidth={3}
                      strokeLinecap="round"
                      opacity={0.45}
                      strokeDasharray="20 16"
                    />
                  </>
                )}
                {/* white centre dashes — always on top of all fills */}
                <line
                  x1={A.x}
                  y1={A.y}
                  x2={B.x}
                  y2={B.y}
                  stroke="rgba(255,255,255,0.22)"
                  strokeWidth={3}
                  strokeDasharray="18 14"
                  strokeLinecap="round"
                />
                {/* distance label — sits above track for normal edges */}
                {!isHidden && (
                  <text
                    x={mx}
                    y={my}
                    textAnchor="middle"
                    fontSize={edgeLabelFontSize}
                    fontWeight="900"
                    fill={pal.text}
                    stroke="rgba(0,0,0,0.8)"
                    strokeWidth={4}
                    paintOrder="stroke"
                  >
                    {`${edge.distance.toFixed(1)} ${config.unit}`}
                  </text>
                )}
                {isHidden && (
                  <text
                    x={mx}
                    y={my + 10}
                    textAnchor="middle"
                    fontSize="54"
                    fontWeight="900"
                    fill={pal.accent}
                    stroke="rgba(0,0,0,0.8)"
                    strokeWidth={6}
                    paintOrder="stroke"
                  >
                    ?
                  </text>
                )}
              </g>
            );
          })}

          {config.stops.map((stop) => {
            const routeFirst = config.stops[currentQ.route[0]].id;
            const routeLast =
              config.stops[currentQ.route[currentQ.route.length - 1]].id;
            return (
              <StopMarker
                key={stop.id}
                stop={stop}
                active={routeStops.has(stop.id)}
                isFirst={stop.id === routeFirst}
                isLast={stop.id === routeLast && routeLast !== routeFirst}
                palette={pal}
                showEndpointLetters={level !== 3}
              />
            );
          })}

          {(!isL3MonsterRound || extinctionL3ShowSteps) && (
            <>
              <g
                transform={`translate(${token.x}, ${token.y - 44})`}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  startDrag(e);
                }}
                style={{ cursor: dragging ? "grabbing" : "grab" }}
              >
                {/* generous transparent hit area */}
                <circle cx={0} cy={-10} r={80} fill="transparent" />
                <RexSprite
                  dino={dino}
                  dinoColor={dinoColor}
                  facingLeft={facingLeft}
                />
              </g>

              {/* Halo rendered last so it always paints above stop markers */}
              {dragging && (
                <g
                  transform={`translate(${token.x}, ${token.y - 44})`}
                  style={{ pointerEvents: "none" }}
                >
                  <circle
                    cx={0}
                    cy={-48}
                    r={62}
                    fill="none"
                    stroke="#4ade80"
                    strokeWidth={10}
                    opacity={0.35}
                  />
                  <circle
                    cx={0}
                    cy={-48}
                    r={62}
                    fill="none"
                    stroke="#4ade80"
                    strokeWidth={4}
                    style={{
                      filter:
                        "drop-shadow(0 0 6px #4ade80) drop-shadow(0 0 16px #22c55e) drop-shadow(0 0 32px #16a34a)",
                    }}
                  />
                </g>
              )}

              {showDinoDragHint && (
                <g
                  transform={`translate(${hintRouteStart.x}, ${hintRouteStart.y - 44})`}
                  style={{ pointerEvents: "none" }}
                >
                  <g
                    style={{
                      animation: "dino-drag-ghost 5.85s ease-in-out infinite",
                      transformBox: "fill-box",
                      transformOrigin: "center",
                      ["--drag-dx" as string]: `${dinoHintDx}px`,
                      ["--drag-dy" as string]: `${dinoHintDy}px`,
                    }}
                  >
                    <RexSprite
                      dino={dino}
                      dinoColor="#67e8f9"
                      facingLeft={facingLeft}
                    />
                    <g
                      transform={`translate(${tutorialHandOffsetX}, ${tutorialHandOffsetY}) scale(${tutorialHandScale})`}
                    >
                      <svg
                        x="-28"
                        y="-8"
                        width="62"
                        height="76"
                        viewBox="0 0 80 100"
                        overflow="visible"
                      >
                        <path
                          d="M24.76,22.64V12.4c0-3.18,2.59-5.77,5.77-5.77,1.44,0,2.82,.54,3.89,1.51,1.07,1,1.72,2.33,1.85,3.76l.87,10.08c2.12-1.88,3.39-4.59,3.39-7.48,0-5.51-4.49-10-10-10s-10,4.49-10,10c0,3.29,1.62,6.29,4.23,8.14Z"
                          fill="#67e8f9"
                          stroke="rgba(2,6,23,0.98)"
                          strokeWidth="4"
                          strokeLinejoin="round"
                          paintOrder="stroke"
                        />
                        <path
                          d="M55.98,69.53c0-.14,.03-.28,.09-.41l4.48-9.92v-18.37c0-1.81-1.08-3.48-2.76-4.26-6.75-3.13-13.8-4.84-20.95-5.08-.51-.01-.92-.41-.97-.91l-1.6-18.5c-.08-.94-.51-1.82-1.2-2.46-.7-.63-1.6-.99-2.54-.99-2.08,0-3.77,1.69-3.77,3.77V48.48h-2v-13.32c-2.61,.46-4.69,2.65-4.91,5.36-.56,6.79-.53,14.06,.08,21.62,.28,3.44,2.42,6.52,5.58,8.05l4.49,2.18c.35,.17,.56,.52,.56,.9v2.23h25.42v-5.97Z"
                          fill="#67e8f9"
                          stroke="rgba(2,6,23,0.98)"
                          strokeWidth="4"
                          strokeLinejoin="round"
                          paintOrder="stroke"
                        />
                      </svg>
                      <g transform="translate(0 74)">
                        <rect
                          x={-tutorialDragHintBoxWidth / 2}
                          y={-tutorialDragHintBoxHeight / 2}
                          width={tutorialDragHintBoxWidth}
                          height={tutorialDragHintBoxHeight}
                          rx={8}
                          fill="rgba(15,23,42,0.88)"
                          stroke="rgba(56,189,248,0.35)"
                          strokeWidth={1}
                        />
                        <text
                          x="0"
                          y="2"
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fontSize={tutorialDragHintFontSize}
                          fontWeight="900"
                          fill="#67e8f9"
                          letterSpacing="0.02em"
                        >
                          {tutorialDragHintLabel}
                        </text>
                      </g>
                    </g>
                  </g>
                </g>
              )}
            </>
          )}
        </svg>

        {odometerMapPos &&
          !isMobileLandscape &&
          screen === "playing" &&
          gamePhase === "normal" &&
          !showMonsterAnnounce &&
          (() => {
            const s = odomKm.toFixed(1);
            return (
              <button
                ref={floatingOdometerRef}
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  resetOdometer();
                }}
                title="Tap to reset"
                className="arcade-meter absolute z-[45] inline-flex w-max max-w-[calc(100vw-1rem)] cursor-pointer flex-col items-stretch px-2 py-2 transition-transform pointer-events-auto active:scale-95 md:px-2.5 md:py-2"
                style={{
                  left: odometerMapPos.left,
                  top: odometerMapPos.top,
                  transform:
                    odometerMapPos.anchor === "right"
                      ? "translate(80px, -50%)"
                      : odometerMapPos.anchor === "left"
                        ? "translate(calc(-100% - 80px), -50%)"
                        : "translate(-50%, -100%)",
                }}
              >
                {currentQ.totalGiven != null ? (
                  <>
                    <div className="flex w-full justify-end">
                      <div
                        className="digital-meter leading-none text-white"
                        style={{
                          width: ODOMETER_MAIN_WIDTH,
                          minWidth: ODOMETER_MAIN_WIDTH,
                          textAlign: "right",
                          fontSize: KEYPAD_DISPLAY_FONT_SIZE,
                          lineHeight: 1,
                        }}
                      >
                        {s}
                      </div>
                    </div>
                    <div className="mt-2 w-full whitespace-nowrap text-center text-base leading-none text-yellow-300 md:text-lg">
                      Σ {currentQ.totalGiven.toFixed(1)} {config.unit}
                    </div>
                  </>
                ) : (
                  <div
                    className="digital-meter leading-none text-white"
                    style={{
                      width: ODOMETER_MAIN_WIDTH,
                      minWidth: ODOMETER_MAIN_WIDTH,
                      textAlign: "right",
                      fontSize: KEYPAD_DISPLAY_FONT_SIZE,
                      lineHeight: 1,
                    }}
                  >
                    {s}
                  </div>
                )}
              </button>
            );
          })()}
      </div>

      {/* ── bottom bar ── */}
      {!isFullScreenOverlayActive && (
        <div
          className={`absolute bottom-0 left-0 right-0 px-3 md:px-5 md:pb-4 z-50 ${useCollapsedQuestionTray ? "pb-2" : "pb-3"}`}
          onClick={() => setTopPanel("question")}
        >
        {/* L3 distance comparison visual — appears after each step is confirmed */}
        {currentQ.subAnswers &&
          currentQ.promptLines &&
          subStep >= 1 &&
          !l3ExtinctionSingleLineOnly &&
          (() => {
            const d1 = currentQ.subAnswers![0];
            const d2 = currentQ.subAnswers![1];
            const showBoth = subStep >= 2;
            const maxD = showBoth ? Math.max(d1, d2) : d1;
            // Derive station names directly from stored hubStop index
            const hubIdx = currentQ.hubStop!;
            const hub = config.stops[hubIdx].label;
            const dest1 = config.stops[hubIdx - 1].label;
            const dest2 = config.stops[hubIdx + 1].label;
            // SVG layout constants
            const W = 380,
              PAD_L = 8,
              PAD_R = 8;
            const lineX0 = PAD_L + 6;
            const lineX1max = W - PAD_R - 6;
            const usableW = lineX1max - lineX0;
            const x1end = lineX0 + (d1 / maxD) * usableW; // line 1 end (proportional)
            const x2end = lineX0 + (d2 / maxD) * usableW; // line 2 end (proportional)
            const xLong = Math.max(x1end, x2end);
            const xShort = Math.min(x1end, x2end);
            const bar1Color = "#4ade80";
            const bar2Color = "#f472b6";
            const diffColor = "#fde047";
            const svgH = showBoth ? 100 : 50;
            return (
              <div className="arcade-panel mb-2 px-2 py-1.5">
                <svg
                  viewBox={`0 0 ${W} ${svgH}`}
                  width="100%"
                  height={svgH}
                  style={{ display: "block", overflow: "visible" }}
                >
                  {/* ── Segment 1 ── */}
                  <line
                    x1={lineX0}
                    y1={22}
                    x2={x1end}
                    y2={22}
                    stroke={bar1Color}
                    strokeWidth={5}
                    strokeLinecap="round"
                  />
                  <circle cx={lineX0} cy={22} r={6} fill={bar1Color} />
                  <circle cx={x1end} cy={22} r={6} fill={bar1Color} />
                  {/* hub label left-anchored at start */}
                  <text
                    x={lineX0}
                    y={42}
                    fontSize={14}
                    fill="#94a3b8"
                    textAnchor="middle"
                  >
                    {hub}
                  </text>
                  {/* dest1 centred on endpoint dot */}
                  <text
                    x={x1end}
                    y={14}
                    fontSize={14}
                    fill={bar1Color}
                    textAnchor="middle"
                  >
                    {dest1}
                  </text>
                  {/* dist1 — centred on the segment */}
                  <text
                    x={(lineX0 + x1end) / 2}
                    y={42}
                    fontSize={14}
                    fill={bar1Color}
                    fontWeight="bold"
                    textAnchor="middle"
                  >
                    {d1.toFixed(1)} {config.unit}
                  </text>

                  {showBoth && (
                    <>
                      {/* ── Segment 2 ── */}
                      <line
                        x1={lineX0}
                        y1={68}
                        x2={x2end}
                        y2={68}
                        stroke={bar2Color}
                        strokeWidth={5}
                        strokeLinecap="round"
                      />
                      <circle cx={lineX0} cy={68} r={6} fill={bar2Color} />
                      <circle cx={x2end} cy={68} r={6} fill={bar2Color} />
                      {/* dest2 centred on endpoint dot */}
                      <text
                        x={x2end}
                        y={60}
                        fontSize={14}
                        fill={bar2Color}
                        textAnchor="middle"
                      >
                        {dest2}
                      </text>
                      {/* dist2 — centred on the segment */}
                      <text
                        x={(lineX0 + x2end) / 2}
                        y={88}
                        fontSize={14}
                        fill={bar2Color}
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        {d2.toFixed(1)} {config.unit}
                      </text>

                      {/* ── Difference bracket ──
                      Anchored at the y-level of the shorter segment so it
                      attaches to its endpoint and never overlaps any label. */}
                      {(() => {
                        const bY = d1 <= d2 ? 22 : 68; // y of the shorter segment
                        return (
                          <>
                            <line
                              x1={xShort}
                              y1={bY}
                              x2={xLong}
                              y2={bY}
                              stroke={diffColor}
                              strokeWidth={3}
                              strokeLinecap="round"
                              strokeDasharray="5 4"
                            />
                            <line
                              x1={xShort}
                              y1={bY - 8}
                              x2={xShort}
                              y2={bY + 8}
                              stroke={diffColor}
                              strokeWidth={2}
                            />
                            <line
                              x1={xLong}
                              y1={bY - 8}
                              x2={xLong}
                              y2={bY + 8}
                              stroke={diffColor}
                              strokeWidth={2}
                            />
                            {/* "?" below the bracket — always in clear space */}
                            <text
                              x={(xShort + xLong) / 2}
                              y={bY + 16}
                              fontSize={16}
                              fill={diffColor}
                              fontWeight="bold"
                              textAnchor="middle"
                            >
                              ?
                            </text>
                          </>
                        );
                      })()}
                    </>
                  )}
                </svg>
              </div>
            );
          })()}

        <div
          className={`grid w-full grid-cols-[minmax(0,1fr)_auto] items-stretch ${isMobileLandscape ? "gap-1.5" : "gap-2 md:gap-3"}`}
          style={useCollapsedQuestionTray ? { minHeight: "68px" } : undefined}
        >
          {currentQ.promptLines && currentQ.subAnswers ? (
            l3ExtinctionSingleLineOnly ? (
              /* ── Level 3 Extinction Event: final prompt only until first wrong ── */
              <div
                className={`arcade-panel flex min-w-0 ${useCollapsedQuestionTray ? "self-start" : "self-stretch"} items-center ${isMobileLandscape ? "gap-1.5 px-2 text-[1rem]" : "gap-2 px-4 text-[1.3125rem] md:text-[1.5rem]"} font-bold text-white cursor-pointer ${collapsedPromptPanelClass}`}
                onClick={() => keypadToggleRef.current?.()}
              >
                <ColoredPrompt
                  text={currentQ.promptLines[2]}
                  stopLabels={stopLabels}
                />
                {IS_DEV && currentQ.subAnswers && (
                  <span
                    className="ml-1 shrink-0 rounded px-1.5 py-0.5 text-xs font-black"
                    style={{
                      background: "rgba(250,204,21,0.18)",
                      color: "#fde047",
                      border: "1px solid rgba(250,204,21,0.35)",
                    }}
                  >
                    {currentQ.subAnswers[2].toFixed(1)}
                  </span>
                )}
              </div>
            ) : (
              /* ── Level 3: stepped one-at-a-time ── */
              <div
                ref={isMobileLandscape ? steppedPromptScrollRef : undefined}
                className={`arcade-panel flex min-h-0 min-w-0 ${useCollapsedQuestionTray ? "self-start" : "self-stretch"} flex-col ${isMobileLandscape ? "gap-1.5 px-2" : "gap-2 px-4"} cursor-pointer ${collapsedStepPanelClass}`}
                style={
                  useCollapsedQuestionTray
                    ? {
                        height: "78px",
                        maxHeight: "78px",
                        overflowY: "auto",
                        overscrollBehavior: "contain",
                      }
                    : undefined
                }
                onClick={() => keypadToggleRef.current?.()}
              >
                {currentQ.promptLines.map((line, i) => {
                  const isDone = i < subStep;
                  const isCurrent = i === subStep;
                  const shouldDim =
                    i > subStep && !l3ExtinctionRevealedScaffold;
                  return (
                    <div
                      key={i}
                      ref={(el) => {
                        steppedPromptItemRefs.current[i] = el;
                      }}
                      className={`flex items-center ${isMobileLandscape ? "gap-1.5" : "gap-2"} transition-opacity duration-200 ${shouldDim ? "opacity-30" : ""}`}
                    >
                      <ColoredPrompt
                        text={line}
                        stopLabels={stopLabels}
                        className={`flex-1 ${isMobileLandscape ? "text-[1rem] leading-[1.25rem]" : "text-[1.3125rem] leading-[1.6rem] md:text-[1.5rem] md:leading-[1.8rem]"} font-bold ${i === 2 ? "text-white" : "text-slate-300"}`}
                      />
                      {IS_DEV && currentQ.subAnswers && (
                        <span
                          className="shrink-0 rounded px-1 text-[10px] font-black"
                          style={{
                            background: "rgba(250,204,21,0.18)",
                            color: "#fde047",
                            border: "1px solid rgba(250,204,21,0.3)",
                          }}
                        >
                          {currentQ.subAnswers[i].toFixed(1)}
                        </span>
                      )}
                      <span className={`${isMobileLandscape ? "text-[1rem]" : "text-[1.3125rem] md:text-[1.5rem]"} text-slate-400`}>=</span>
                      {isDone ? (
                        /* completed step — confirmed value */
                        <div className={`${isMobileLandscape ? "w-20" : "w-24 md:w-28"} flex items-center justify-end gap-1`}>
                          <span className={`whitespace-nowrap text-green-400 ${isMobileLandscape ? "text-[1rem]" : "text-[1.3125rem] md:text-[1.5rem]"} font-bold`}>
                            {subAnswers[i]} {config.unit}
                          </span>
                        </div>
                      ) : isCurrent ? (
                        <div
                          className={`${isMobileLandscape ? "w-16 px-1.5 text-[1rem]" : "w-24 px-2 text-[1.3125rem] md:w-28 md:text-[1.5rem]"} rounded-lg border-[3px] border-white/70 bg-slate-950 py-1 text-cyan-300 text-right digital-meter`}
                          aria-live="polite"
                        >
                          {subAnswers[i] || "0"}
                        </div>
                      ) : (
                        /* future step — empty placeholder */
                        <div className={`${isMobileLandscape ? "w-16" : "w-24 md:w-28"} h-[34px] rounded-lg border-[2px] border-white/15 bg-slate-950/40`} />
                      )}
                      <div
                        className={`shrink-0 h-8 w-8 ${!isCurrent ? "opacity-30" : ""}`}
                      />
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            /* ── Level 1 / 2: single row ── */
            <div
              className={`arcade-panel flex min-w-0 ${useCollapsedQuestionTray ? "self-start" : "self-stretch"} items-center ${isMobileLandscape ? "gap-1.5 px-2 text-[1rem]" : "gap-2 px-4 text-[1.3125rem] md:text-[1.5rem]"} font-bold text-white cursor-pointer ${collapsedPromptPanelClass}`}
              onClick={() => keypadToggleRef.current?.()}
            >
              <ColoredPrompt text={currentQ.prompt} stopLabels={stopLabels} />
              {IS_DEV && (
                <span
                  className="ml-1 shrink-0 rounded px-1.5 py-0.5 text-xs font-black"
                  style={{
                    background: "rgba(250,204,21,0.18)",
                    color: "#fde047",
                    border: "1px solid rgba(250,204,21,0.35)",
                  }}
                >
                  {currentQ.answer.toFixed(1)}
                </span>
              )}
            </div>
          )}
          <div className="flex min-h-0 flex-col self-start">
            <NumericKeypad
              value={keypadValue}
              onChange={handleKeypadChange}
              onSubmit={submitAnswer}
              canSubmit={canKeypadSubmit}
              showDisplayHint={
                showKeypadDisplayHint || showMonsterKeypadDisplayHint
              }
              onDisplayHintConsumed={() => {
                if (showKeypadDisplayHint) {
                  setHasDiscoveredKeypadDisplay(true);
                }
                if (showMonsterKeypadDisplayHint) {
                  setHasDiscoveredMonsterKeypadDisplay(true);
                }
              }}
              displayHintVariant={
                showMonsterKeypadDisplayHint ? "display-center" : "default"
              }
              roundKey={calcRoundKey}
              defaultMinimized={isCoarsePointer}
              onMinimizedChange={setIsKeypadMinimized}
              toggleRef={keypadToggleRef}
              minimizeRef={keypadMinimizeRef}
            />
          </div>
        </div>
        </div>
      )}
      {!isFullScreenOverlayActive && (
        <div ref={rightControlsRef} className="social-launchers">
          <button
            type="button"
            onClick={toggleShareDrawer}
            className={`social-launcher arcade-button ${showShareDrawer ? "is-active" : ""}`}
            aria-expanded={showShareDrawer}
            aria-controls="social-share-drawer"
            aria-label="Open share panel"
          >
          <svg
            viewBox="0 0 24 24"
            className="social-launcher-icon"
            fill="none"
            aria-hidden="true"
          >
            <circle
              cx="18"
              cy="5.5"
              r="2.25"
              stroke="currentColor"
              strokeWidth="1.9"
            />
            <circle
              cx="6"
              cy="12"
              r="2.25"
              stroke="currentColor"
              strokeWidth="1.9"
            />
            <circle
              cx="18"
              cy="18.5"
              r="2.25"
              stroke="currentColor"
              strokeWidth="1.9"
            />
            <path
              d="M8.1 10.95 15.9 6.55"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
            />
            <path
              d="M8.1 13.05 15.9 17.45"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
            />
          </svg>
          </button>
          <button
            type="button"
            onClick={toggleCommentsDrawer}
            className={`social-launcher arcade-button ${showCommentsDrawer ? "is-active" : ""}`}
            aria-expanded={showCommentsDrawer}
            aria-controls="social-comments-drawer"
            aria-label="Open comments panel"
          >
          <svg
            viewBox="0 0 24 24"
            className="social-launcher-icon"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M6 6.5h12a2.5 2.5 0 0 1 2.5 2.5v6a2.5 2.5 0 0 1-2.5 2.5H10l-4 3v-3H6A2.5 2.5 0 0 1 3.5 15V9A2.5 2.5 0 0 1 6 6.5Z"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          </button>
        </div>
      )}

      {isSocialDrawerOpen && (
        <div className="social-backdrop" onClick={closeSocialDrawers} />
      )}

      <aside
        id="social-share-drawer"
        className={`social-drawer social-share-drawer ${showShareDrawer ? "is-open" : ""}`}
        aria-hidden={!showShareDrawer}
      >
        <div className="social-drawer-header">
          <h2>Spread the word...</h2>
          <button
            type="button"
            onClick={() => setShowShareDrawer(false)}
            className="social-drawer-close"
            aria-label="Close share drawer"
          >
            <svg
              viewBox="0 0 24 24"
              className="social-close-icon"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M6 6 18 18"
                stroke="currentColor"
                strokeWidth="2.6"
                strokeLinecap="round"
              />
              <path
                d="M18 6 6 18"
                stroke="currentColor"
                strokeWidth="2.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        <SocialShare />
      </aside>

      <aside
        id="social-comments-drawer"
        className={`social-drawer social-comments-drawer ${showCommentsDrawer ? "is-open" : ""}`}
        aria-hidden={!showCommentsDrawer}
      >
        <div className="social-drawer-header">
          <button type="button" className="social-new-comment" onClick={openCommentsComposer}>
            Add Comment
          </button>
          <div className="social-drawer-header-actions">
            <button
              type="button"
              onClick={() => setShowCommentsDrawer(false)}
              className="social-drawer-close"
              aria-label="Close comments drawer"
            >
              <svg
                viewBox="0 0 24 24"
                className="social-close-icon"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M6 6 18 18"
                  stroke="currentColor"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                />
                <path
                  d="M18 6 6 18"
                  stroke="currentColor"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </div>
        <div className="social-comments-shell">
          <SocialComments />
        </div>
      </aside>

      {flash &&
        (flash.icon ? (
          /* big tick / cross icon — centred on screen */
          <div className="pointer-events-none absolute inset-0 z-50 overflow-hidden">
            {flash.ok ? (
              /* ✓ green tick */
              <svg
                viewBox="0 0 120 120"
                width="110"
                height="110"
                style={{
                  position: "absolute",
                  top: "38%",
                  left: "50%",
                  animation:
                    "icon-pop 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards",
                  filter:
                    "drop-shadow(0 0 24px #4ade80) drop-shadow(0 0 48px #16a34a)",
                }}
              >
                <circle cx="60" cy="60" r="54" fill="#052e16" opacity="0.82" />
                <circle
                  cx="60"
                  cy="60"
                  r="54"
                  fill="none"
                  stroke="#4ade80"
                  strokeWidth="5"
                />
                <path
                  d="M30 62 L50 82 L90 38"
                  fill="none"
                  stroke="#4ade80"
                  strokeWidth="13"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            ) : (
              /* ✗ red cross */
              <svg
                viewBox="0 0 120 120"
                width="110"
                height="110"
                style={{
                  position: "absolute",
                  top: "38%",
                  left: "50%",
                  animation:
                    "icon-pop-wrong 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards",
                  filter:
                    "drop-shadow(0 0 24px #f87171) drop-shadow(0 0 48px #b91c1c)",
                }}
              >
                <circle cx="60" cy="60" r="54" fill="#2d0a0a" opacity="0.82" />
                <circle
                  cx="60"
                  cy="60"
                  r="54"
                  fill="none"
                  stroke="#f87171"
                  strokeWidth="5"
                />
                <path
                  d="M38 38 L82 82 M82 38 L38 82"
                  fill="none"
                  stroke="#f87171"
                  strokeWidth="13"
                  strokeLinecap="round"
                />
              </svg>
            )}
          </div>
        ) : (
          /* text flash for validation messages */
          <div
            className={`pointer-events-none absolute left-1/2 top-[30%] z-40 -translate-x-1/2 rounded-xl border-2 px-8 py-4 text-2xl font-black uppercase tracking-widest animate-bounce-in ${flash.ok ? "border-emerald-400 bg-emerald-950/90 text-emerald-300" : "border-pink-400 bg-pink-950/90 text-pink-300"}`}
          >
            {flash.text}
          </div>
        ))}

      {/* ── Game Over / All Levels Complete ── */}
      {screen === "gameover" && (
        <div
          className="absolute inset-0 z-[80] flex items-center justify-center"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(88,28,135,0.97) 0%, rgba(5,2,18,0.99) 80%)",
          }}
        >
          <div
            className="arcade-panel p-8 md:p-12 text-center mx-6 max-w-lg w-full"
            style={{
              boxShadow:
                "0 0 40px rgba(251,191,36,0.35), 0 0 80px rgba(109,40,217,0.3)",
            }}
          >
            {/* Dino row */}
            <div className="flex justify-center gap-3 text-4xl mb-4">
              <span>🦕</span>
              <span>🦖</span>
              <span>🦕</span>
            </div>

            <div
              className="text-3xl md:text-4xl font-black uppercase tracking-widest text-yellow-300"
              style={{
                textShadow:
                  "0 0 24px rgba(250,204,21,0.8), 0 0 48px rgba(250,204,21,0.35)",
              }}
            >
              You Did It!
            </div>
            <div className="mt-2 text-base md:text-lg text-purple-200 font-bold tracking-wide">
              All 3 Levels Mastered
            </div>
            <div className="mt-1 text-sm text-purple-400">
              Including every Monster Round!
            </div>

            {/* 10 golden eggs — two rows */}
            <div className="flex flex-col gap-2 items-center mt-5">
              {[0, 5].map((rowStart) => (
                <div key={rowStart} className="flex justify-center gap-1.5">
                  {EGG_INDICES.slice(rowStart, rowStart + 5).map((i) => (
                    <svg
                      key={i}
                      viewBox="0 0 512 512"
                      width="30"
                      height="30"
                      style={{
                        filter:
                          "drop-shadow(0 0 8px rgba(250,204,21,0.95)) drop-shadow(0 0 18px rgba(251,191,36,0.55))",
                      }}
                    >
                      <path
                        d="M256 16C166 16 76 196 76 316c0 90 60 180 180 180s180-90 180-180c0-120-90-300-180-300z"
                        fill="#facc15"
                        stroke="#fbbf24"
                        strokeWidth="18"
                      />
                      <ellipse
                        cx="190"
                        cy="150"
                        rx="35"
                        ry="60"
                        fill="#fef08a"
                        opacity="0.4"
                        transform="rotate(-20 190 150)"
                      />
                    </svg>
                  ))}
                </div>
              ))}
            </div>

            <button
              onClick={() => {
                setUnlockedLevel(1);
                beginNewRun(1);
              }}
              className="arcade-button mt-8 px-10 py-4 text-lg font-black uppercase tracking-wider w-full"
              style={{
                boxShadow: "0 0 16px rgba(251,191,36,0.4), 0 6px 0 #78350f",
                borderColor: "#fbbf24",
              }}
            >
              Play Again
            </button>
          </div>
        </div>
      )}

      {/* Monster Round entry announcement — full-screen dramatic overlay */}
      {showMonsterAnnounce && (
        <div
          className="absolute inset-0 z-[70] flex flex-col items-center justify-center"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(88,28,135,0.95) 0%, rgba(10,2,20,0.98) 75%)",
          }}
        >
          <div
            className="text-4xl md:text-5xl font-black uppercase tracking-widest text-yellow-300 text-center px-4"
            style={{
              textShadow:
                "0 0 30px rgba(250,204,21,0.8), 0 0 60px rgba(250,204,21,0.35)",
            }}
          >
            {monsterRoundName}
          </div>
          <div
            className="mt-5 rounded-xl px-5 py-3 text-lg text-purple-100 tracking-wide"
            style={{
              background: "rgba(15, 23, 42, 0.72)",
              border: "1px solid rgba(196, 181, 253, 0.22)",
            }}
          >
            No odometer — solve it in your head!
          </div>
          <div className="mt-2 text-xl text-yellow-400 font-black">
            Collect {EGGS_PER_LEVEL} Golden Eggs ✨
          </div>
        </div>
      )}

      {screen === "won" && (
        <div
          className="absolute inset-0 z-[80] flex items-center justify-center p-6"
          style={{
            background:
              "radial-gradient(ellipse at center, rgba(15,23,42,0.985) 0%, rgba(2,6,23,0.995) 78%)",
          }}
        >
          <div className="arcade-panel p-10 text-center">
            {gamePhase === "monster" ? (
              <>
                <div className="text-4xl font-black uppercase tracking-[0.18em] text-yellow-300 md:text-5xl">
                  Level {level} Complete!
                </div>
                <div className="mt-1 text-lg text-purple-300 font-bold">
                  🦕 Monster Round Crushed! 🦕
                </div>
                <div className="mt-2 flex flex-col gap-1.5 items-center">
                  {[0, 5].map((rowStart) => (
                    <div
                      key={rowStart}
                      className="flex items-center justify-center gap-1"
                    >
                      {EGG_INDICES.slice(rowStart, rowStart + 5).map((i) => (
                        <svg
                          key={i}
                          viewBox="0 0 512 512"
                          width="24"
                          height="24"
                          style={{
                            filter:
                              "drop-shadow(0 0 6px rgba(250,204,21,0.95)) drop-shadow(0 0 14px rgba(251,191,36,0.6))",
                          }}
                        >
                          <path
                            d="M256 16C166 16 76 196 76 316c0 90 60 180 180 180s180-90 180-180c0-120-90-300-180-300z"
                            fill="#facc15"
                            stroke="#fbbf24"
                            strokeWidth="18"
                          />
                          <ellipse
                            cx="190"
                            cy="150"
                            rx="35"
                            ry="60"
                            fill="#fef08a"
                            opacity="0.4"
                            transform="rotate(-20 190 150)"
                          />
                        </svg>
                      ))}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="text-4xl font-black uppercase tracking-[0.18em] text-emerald-400 md:text-5xl">
                  Level {level} Clear!
                </div>
                <div className="mt-2 text-xl text-yellow-300">
                  All {EGGS_PER_LEVEL} eggs collected!
                </div>
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
