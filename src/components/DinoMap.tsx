import type { GameMap, MapNode, MapEdge } from "../data/gameData";

interface Props {
  map: GameMap;
}

function midpoint(a: MapNode, b: MapNode) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function angle(a: MapNode, b: MapNode) {
  return Math.atan2(b.y - a.y, b.x - a.x) * (180 / Math.PI);
}

export default function DinoMap({ map }: Props) {
  const nodeMap = Object.fromEntries(map.nodes.map((n) => [n.id, n]));

  return (
    <div className="w-full">
      {map.totalLabel && (
        <div className="text-center mb-2">
          <span className="inline-block bg-amber-100 border border-amber-300 text-amber-800 text-sm font-bold px-3 py-1 rounded-full">
            📏 {map.totalLabel}
          </span>
        </div>
      )}
      <svg viewBox="0 0 340 180" className="w-full max-h-48" style={{ overflow: "visible" }}>
        {/* Edges */}
        {map.edges.map((edge: MapEdge, i: number) => {
          const a = nodeMap[edge.from];
          const b = nodeMap[edge.to];
          if (!a || !b) return null;
          const mid = midpoint(a, b);
          const ang = angle(a, b);
          const isQuestion = edge.distance === "?";
          const isHighlight = edge.highlight;

          return (
            <g key={i}>
              <line
                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke={isHighlight ? "#f59e0b" : isQuestion ? "#ef4444" : "#94a3b8"}
                strokeWidth={isHighlight ? 3 : 2}
                strokeDasharray={isQuestion ? "6 4" : undefined}
              />
              {/* Distance label */}
              <g transform={`translate(${mid.x},${mid.y}) rotate(${ang})`}>
                <rect
                  x={-18} y={-11} width={36} height={18} rx={6}
                  fill={isQuestion ? "#fee2e2" : isHighlight ? "#fef3c7" : "white"}
                  stroke={isQuestion ? "#ef4444" : isHighlight ? "#f59e0b" : "#cbd5e1"}
                  strokeWidth={1.5}
                />
                <text
                  x={0} y={4}
                  textAnchor="middle"
                  fontSize={isQuestion ? "11" : "10"}
                  fontWeight="700"
                  fill={isQuestion ? "#ef4444" : isHighlight ? "#92400e" : "#334155"}
                >
                  {isQuestion ? "?" : `${edge.distance}`}
                </text>
              </g>
            </g>
          );
        })}

        {/* Nodes */}
        {map.nodes.map((node: MapNode) => (
          <g key={node.id} transform={`translate(${node.x},${node.y})`}>
            <circle r={22} fill="white" stroke="#e2e8f0" strokeWidth={2} />
            <text y={7} textAnchor="middle" fontSize="18">{node.emoji}</text>
            <text y={36} textAnchor="middle" fontSize="9" fontWeight="600" fill="#475569">
              {node.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
