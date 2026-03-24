import { useState, useEffect, useRef } from "react";
import type { GameMap, MapNode } from "../data/gameData";
import { playStep, playSnap } from "../sound";

// ─── types ───────────────────────────────────────────────────────────────────
type RouteId = "A" | "B" | "C";
type MapMode = "linear" | "missing" | "fork";
interface PathPoint { node: MapNode; cumDist: number; }

const ROUTE_COLORS: Record<RouteId, string> = {
  A: "#3b82f6",
  B: "#f59e0b",
  C: "#8b5cf6",
};
const ROUTE_LABELS: Record<RouteId, string> = {
  A: "Route A",
  B: "Route B",
  C: "Route C",
};
const ANIM_DURATION = 1400;

// ─── helpers ─────────────────────────────────────────────────────────────────
function detectMode(map: GameMap): MapMode {
  if (map.edges.some(e => e.distance === "?")) return "missing";
  if (map.nodes.some(n => n.id === "S")) return "fork";
  return "linear";
}

function buildLinearPath(map: GameMap): PathPoint[] {
  const nodeMap = new Map(map.nodes.map(n => [n.id, n]));
  const hasIncoming = new Set(map.edges.map(e => e.to));
  const startId = map.nodes.find(n => !hasIncoming.has(n.id))?.id ?? map.nodes[0].id;
  const path: PathPoint[] = [];
  let cur = startId, cum = 0;
  while (cur) {
    const node = nodeMap.get(cur);
    if (!node) break;
    path.push({ node, cumDist: cum });
    const edge = map.edges.find(e => e.from === cur && e.distance !== "?");
    if (!edge) break;
    cum += Number(edge.distance);
    cur = edge.to;
  }
  return path;
}

function lerp(path: PathPoint[], km: number): { x: number; y: number } {
  if (!path.length) return { x: 0, y: 0 };
  km = Math.max(0, km);
  for (let i = 1; i < path.length; i++) {
    const { node: a, cumDist: d0 } = path[i - 1];
    const { node: b, cumDist: d1 } = path[i];
    if (km <= d1 || i === path.length - 1) {
      const seg = d1 - d0;
      const t = seg > 0 ? Math.min(1, (km - d0) / seg) : 1;
      return { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
    }
  }
  const last = path[path.length - 1];
  return { x: last.node.x, y: last.node.y };
}

function buildRoutePath(map: GameMap, routeId: RouteId): PathPoint[] {
  const nodeMap = new Map(map.nodes.map(n => [n.id, n]));
  const e1 = map.edges.find(e => e.from === "S" && e.to === routeId);
  const e2 = map.edges.find(e => e.from === routeId && e.to === "E");
  if (!e1 || !e2) return [];
  const d1 = Number(e1.distance), d2 = Number(e2.distance);
  return [
    { node: nodeMap.get("S")!, cumDist: 0 },
    { node: nodeMap.get(routeId)!, cumDist: d1 },
    { node: nodeMap.get("E")!, cumDist: d1 + d2 },
  ];
}

function getRoutes(map: GameMap): RouteId[] {
  return (["A", "B", "C"] as RouteId[]).filter(r => map.nodes.some(n => n.id === r));
}

// ─── component ───────────────────────────────────────────────────────────────
export default function InteractiveDinoMap({ map }: { map: GameMap }) {
  const mode = detectMode(map);
  const nodeMap = new Map(map.nodes.map(n => [n.id, n]));

  // ── Linear path state ──────────────────────────────────────────────────────
  const linPath = mode !== "fork" ? buildLinearPath(map) : [];
  const maxKm = linPath.length ? linPath[linPath.length - 1].cumDist : 0;
  const [sliderKm, setSliderKm] = useState(0);
  const prevSliderRef = useRef(0);

  // ── Missing segment state ──────────────────────────────────────────────────
  const missingEdge = mode === "missing" ? map.edges.find(e => e.distance === "?") : null;
  const knownKm = mode === "missing"
    ? map.edges.filter(e => e.distance !== "?").reduce((s, e) => s + Number(e.distance), 0)
    : 0;
  const targetKm = mode === "missing" && map.totalLabel
    ? parseFloat(map.totalLabel.replace(/[^0-9.]/g, ""))
    : 0;
  const missingKm = targetKm - knownKm;

  // ── Fork (route race) state ────────────────────────────────────────────────
  const routes = mode === "fork" ? getRoutes(map) : [];
  const [activeRoute, setActiveRoute] = useState<RouteId | null>(null);
  const [completedRoutes, setCompletedRoutes] = useState<Partial<Record<RouteId, number>>>({});
  const [animProgress, setAnimProgress] = useState(0);
  const animFrameRef = useRef<number | null>(null);
  const animStartRef = useRef<number | null>(null);
  const lastWpRef = useRef(-1);

  function startRoute(routeId: RouteId) {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    setActiveRoute(routeId);
    setAnimProgress(0);
    animStartRef.current = null;
    lastWpRef.current = -1;

    const routePath = buildRoutePath(map, routeId);
    const total = routePath[routePath.length - 1]?.cumDist ?? 0;

    function frame(ts: number) {
      if (!animStartRef.current) animStartRef.current = ts;
      const p = Math.min(1, (ts - animStartRef.current) / ANIM_DURATION);
      setAnimProgress(p);

      const currentKm = p * total;
      for (let i = 1; i < routePath.length; i++) {
        if (currentKm >= routePath[i].cumDist && lastWpRef.current < i) {
          lastWpRef.current = i;
          if (i < routePath.length - 1) playStep(); else playSnap();
        }
      }

      if (p < 1) {
        animFrameRef.current = requestAnimationFrame(frame);
      } else {
        setCompletedRoutes(prev => ({ ...prev, [routeId]: total }));
        setActiveRoute(null);
      }
    }
    animFrameRef.current = requestAnimationFrame(frame);
  }

  useEffect(() => {
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); };
  }, []);

  // ── Dino position ──────────────────────────────────────────────────────────
  let dinoXY: { x: number; y: number } | null = null;

  if (mode === "fork" && activeRoute) {
    const path = buildRoutePath(map, activeRoute);
    const total = path[path.length - 1]?.cumDist ?? 1;
    dinoXY = lerp(path, animProgress * total);
  } else if (mode === "linear") {
    dinoXY = lerp(linPath, sliderKm);
  } else if (mode === "missing" && missingEdge) {
    const fromNode = nodeMap.get(missingEdge.from);
    const toNode = nodeMap.get(missingEdge.to);
    if (fromNode && toNode) {
      const t = missingKm > 0 ? Math.min(1, sliderKm / missingKm) : 0;
      dinoXY = {
        x: fromNode.x + t * (toNode.x - fromNode.x),
        y: fromNode.y + t * (toNode.y - fromNode.y),
      };
    }
  }

  const atEnd = mode === "linear" && sliderKm >= maxKm - 0.01;
  const guessTotal = knownKm + sliderKm;
  const guessMatch = mode === "missing" && Math.abs(guessTotal - targetKm) < 0.15;

  // ── Handle linear slider change with sounds ────────────────────────────────
  function handleLinearSlider(v: number) {
    const prev = prevSliderRef.current;
    setSliderKm(v);
    prevSliderRef.current = v;
    for (let i = 1; i < linPath.length; i++) {
      if (v >= linPath[i].cumDist && prev < linPath[i].cumDist) {
        if (i < linPath.length - 1) playStep(); else playSnap();
      }
    }
  }

  // ── SVG dims ───────────────────────────────────────────────────────────────
  const svgW = 340, svgH = 190;

  return (
    <div className="select-none">
      {/* SVG Map */}
      <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-gradient-to-b from-sky-100 to-emerald-50">
        <svg viewBox={`0 0 ${svgW} ${svgH}`} width="100%">
          <defs>
            <pattern id="dots" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
              <circle cx="12" cy="12" r="0.7" fill="#a7f3d0" opacity="0.7" />
            </pattern>
          </defs>
          <rect width={svgW} height={svgH} fill="url(#dots)" />

          {/* Total label badge for missing-segment maps */}
          {map.totalLabel && (
            <>
              <rect x={svgW / 2 - 64} y={5} width={128} height={22} rx={11} fill="#fef3c7" stroke="#fbbf24" strokeWidth={1.5} />
              <text x={svgW / 2} y={20} textAnchor="middle" fontSize={11} fontWeight="bold" fill="#92400e">
                {map.totalLabel}
              </text>
            </>
          )}

          {/* Edges */}
          {map.edges.map((edge, i) => {
            const a = nodeMap.get(edge.from);
            const b = nodeMap.get(edge.to);
            if (!a || !b) return null;

            let color = "#94a3b8";
            let strokeW = 2.5;
            let opacity = 1;
            let dashArray: string | undefined;

            if (mode === "fork") {
              const rid = (["A", "B", "C"] as RouteId[]).find(r => edge.from === r || edge.to === r);
              if (rid) {
                color = ROUTE_COLORS[rid];
                if (activeRoute && activeRoute !== rid) opacity = 0.2;
                else if (activeRoute === rid) strokeW = 3.5;
                else if (completedRoutes[rid] !== undefined) opacity = 0.5;
              }
            } else if (edge.distance === "?") {
              color = "#f59e0b";
              strokeW = 3;
              dashArray = "7,5";
            } else if (edge.highlight) {
              color = "#10b981";
              strokeW = 3;
            }

            const mx = (a.x + b.x) / 2;
            const my = (a.y + b.y) / 2;
            const labelText = edge.distance === "?" ? "?" : `${edge.distance}`;
            const boxW = edge.distance === "?" ? 22 : labelText.length <= 3 ? 28 : 38;

            return (
              <g key={i} opacity={opacity}>
                <line
                  x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                  stroke={color} strokeWidth={strokeW}
                  strokeLinecap="round"
                  strokeDasharray={dashArray}
                />
                <rect
                  x={mx - boxW / 2} y={my - 9}
                  width={boxW} height={18} rx={9}
                  fill="white" stroke={color} strokeWidth={1.2}
                />
                <text
                  x={mx} y={my + 4.5}
                  textAnchor="middle"
                  fontSize={10} fontWeight="bold" fill={color}
                >
                  {labelText}
                </text>
              </g>
            );
          })}

          {/* Nodes */}
          {map.nodes.map(node => {
            const isWaypoint = mode === "linear" && linPath.some(
              (pp, idx) => idx > 0 && idx < linPath.length - 1 && pp.node.id === node.id && sliderKm >= pp.cumDist
            );
            return (
              <g key={node.id}>
                <circle
                  cx={node.x} cy={node.y} r={17}
                  fill={isWaypoint ? "#d1fae5" : "white"}
                  stroke={isWaypoint ? "#10b981" : "#cbd5e1"}
                  strokeWidth={isWaypoint ? 2.5 : 1.5}
                />
                <text x={node.x} y={node.y + 5.5} textAnchor="middle" fontSize={14}>
                  {node.emoji}
                </text>
                <text
                  x={node.x} y={node.y + 30}
                  textAnchor="middle" fontSize={9}
                  fill="#64748b" fontWeight="500"
                >
                  {node.label}
                </text>
              </g>
            );
          })}

          {/* Completed route totals on map */}
          {mode === "fork" && Object.entries(completedRoutes).map(([rid, total]) => {
            const endNode = nodeMap.get("E");
            if (!endNode) return null;
            const viaNode = nodeMap.get(rid);
            if (!viaNode) return null;
            const mx = (viaNode.x + endNode.x) / 2;
            const my = (viaNode.y + endNode.y) / 2 - 12;
            return (
              <g key={rid}>
                <rect x={mx - 20} y={my - 8} width={40} height={16} rx={8}
                  fill={ROUTE_COLORS[rid as RouteId]} opacity={0.9} />
                <text x={mx} y={my + 4} textAnchor="middle" fontSize={9}
                  fontWeight="bold" fill="white">
                  {total.toFixed(1)}km
                </text>
              </g>
            );
          })}

          {/* Dino */}
          {dinoXY && (
            <g>
              <circle
                cx={dinoXY.x} cy={dinoXY.y} r={15}
                fill={atEnd || guessMatch ? "#d1fae5" : "#fef9c3"}
                stroke={atEnd || guessMatch ? "#10b981" : "#fbbf24"}
                strokeWidth={2.5}
              />
              <text x={dinoXY.x} y={dinoXY.y + 6} textAnchor="middle" fontSize={14}>
                🦕
              </text>
            </g>
          )}

          {/* Celebration sparkles when dino arrives */}
          {(atEnd || guessMatch) && dinoXY && (
            <>
              {["✨", "⭐", "✨"].map((s, i) => (
                <text
                  key={i}
                  x={dinoXY!.x + [-18, 0, 18][i]}
                  y={dinoXY!.y - 20}
                  textAnchor="middle"
                  fontSize={12}
                  style={{ animation: `floatUp 0.6s ease-out ${i * 0.1}s both` }}
                >
                  {s}
                </text>
              ))}
            </>
          )}
        </svg>
      </div>

      {/* ── Level 1: exploration slider ───────────────────────────────────── */}
      {mode === "linear" && maxKm > 0 && (
        <div className="mt-3 bg-emerald-50 border border-emerald-200 rounded-2xl p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-emerald-700 font-bold">Drag Rex along the path:</span>
            <span className={`text-sm font-black transition-all ${atEnd ? "text-emerald-600 scale-110" : "text-slate-700"}`}>
              {atEnd ? "🎉 " : "🦕 "}
              {sliderKm.toFixed(1)} km
              {atEnd ? " — arrived!" : ""}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={maxKm}
            step={0.05}
            value={sliderKm}
            onChange={e => handleLinearSlider(parseFloat(e.target.value))}
            className="w-full h-3 rounded-full cursor-pointer accent-emerald-500"
          />
          <div className="flex justify-between text-xs text-emerald-600 mt-1 font-medium">
            <span>Start 0 km</span>
            <span>End {maxKm.toFixed(1)} km</span>
          </div>
        </div>
      )}

      {/* ── Level 2: missing segment slider ──────────────────────────────── */}
      {mode === "missing" && (
        <div className="mt-3 bg-amber-50 border border-amber-200 rounded-2xl p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-amber-700 font-bold">🔍 Guess the missing distance:</span>
            <span className={`text-sm font-black ${guessMatch ? "text-emerald-600" : "text-amber-700"}`}>
              {sliderKm.toFixed(1)} km {guessMatch ? "✓" : ""}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={Math.max(targetKm, 8)}
            step={0.1}
            value={sliderKm}
            onChange={e => setSliderKm(parseFloat(e.target.value))}
            className="w-full h-3 rounded-full cursor-pointer accent-amber-500"
          />
          <div className="flex justify-between items-center text-xs mt-2">
            <span className="text-slate-500">
              {knownKm.toFixed(1)} + <span className="font-bold text-amber-600">{sliderKm.toFixed(1)}</span> =
            </span>
            <span className={`font-bold text-sm ${guessMatch ? "text-emerald-600" : Math.abs(guessTotal - targetKm) < 0.6 ? "text-amber-600" : "text-slate-500"}`}>
              {guessTotal.toFixed(1)} km
              {guessMatch ? " 🎯 Match!" : ` (target: ${targetKm.toFixed(1)})`}
            </span>
          </div>
        </div>
      )}

      {/* ── Levels 3-4: route test buttons ───────────────────────────────── */}
      {mode === "fork" && (
        <div className="mt-3">
          <div className="text-xs text-slate-500 text-center mb-2 font-medium">
            Press each button to watch Rex run the route! 🏃
          </div>
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${routes.length}, 1fr)` }}>
            {routes.map(routeId => {
              const total = completedRoutes[routeId];
              const isRunning = activeRoute === routeId;
              const c = ROUTE_COLORS[routeId];
              return (
                <button
                  key={routeId}
                  onClick={() => !activeRoute && startRoute(routeId)}
                  disabled={!!activeRoute}
                  className="py-3 px-2 rounded-xl text-sm font-bold transition-all active:scale-95 border-2 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: c + (isRunning ? "30" : "15"),
                    borderColor: c,
                    color: c,
                    opacity: activeRoute && !isRunning ? 0.5 : 1,
                  }}
                >
                  {isRunning
                    ? <span className="animate-pulse">Running…</span>
                    : total !== undefined
                    ? <><div>{ROUTE_LABELS[routeId]}</div><div className="text-base font-black">{total.toFixed(1)} km</div></>
                    : `▶ ${ROUTE_LABELS[routeId]}`}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
