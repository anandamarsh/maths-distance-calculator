export interface TrailStop {
  id: string;
  label: string;
  x: number;
  y: number;
}

export interface TrailEdge {
  from: string;
  to: string;
  distance: number;
}

export interface TrailConfig {
  id: string;
  unit: "km" | "mi";
  palette: {
    bg: string;
    bgGlow: string;
    panel: string;
    trail: string;
    visited: string;
    repeated: string;
    node: string;
    text: string;
    accent: string;
  };
  stops: TrailStop[];
  edges: TrailEdge[];
}

export interface TrailQuestion {
  id: string;
  route: number[];
  prompt: string;
  promptKey: string;
  promptVars: Record<string, string | number>;
  answer: number;
  hiddenEdge?: number;
  totalGiven?: number;
  promptLines?: [string, string, string];
  promptLineKeys?: [string, string, string];
  promptLineVars?: [
    Record<string, string | number>,
    Record<string, string | number>,
    Record<string, string | number>,
  ];
  subAnswers?: [number, number, number];
  hubStop?: number;
  legA?: number;
  legB?: number;
}

export type GameRound = "normal" | "monster";
