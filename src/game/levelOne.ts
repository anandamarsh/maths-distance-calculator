import type { TFunction } from "../i18n/types";

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
  route: number[];       // stop indices
  prompt: string;        // pre-baked locale string (used in PDF / session log)
  promptKey: string;     // translation key — re-render via t(promptKey, promptVars) for reactive UI
  promptVars: Record<string, string | number>;
  answer: number;
  hiddenEdge?: number;   // Level 2: index of the edge whose label is "?"
  totalGiven?: number;   // Level 2: total distance shown to the child
  // Level 3: "how much farther"
  promptLines?: [string, string, string];
  promptLineKeys?: [string, string, string];
  promptLineVars?: [Record<string, string | number>, Record<string, string | number>, Record<string, string | number>];
  subAnswers?: [number, number, number];  // answers for each of the 3 lines
  hubStop?: number;      // common stop index
  legA?: number;         // edge index going one way
  legB?: number;         // edge index going the other way
}

const PLACE_POOL = [
  "Newtown", "Ashfield", "Marrickville", "Leichhardt", "Erskineville",
  "Redfern", "Tempe", "Sydenham", "Enmore", "Stanmore",
  "Petersham", "Dulwich", "Rozelle", "Balmain", "Drummoyne",
  "Concord", "Rhodes", "Burwood", "Strathfield", "Homebush",
  "Croydon", "Lidcombe", "Bankstown", "Lakemba", "Belmore",
  "Hurstville", "Kogarah", "Rockdale", "Sylvania", "Miranda",
];

// Delhi-area stations for Hindi locale
const PLACE_POOL_HI = [
  "कनॉट प्लेस", "लाजपत नगर", "करोल बाग", "चाँदनी चौक", "सरोजिनी नगर",
  "नेहरू प्लेस", "द्वारका", "रोहिणी", "पटेल नगर", "जनकपुरी",
  "सफदरजंग", "लोधी रोड", "मयूर विहार", "वसंत कुंज", "मालवीय नगर",
  "हौज खास", "साकेत", "राजेंद्र नगर", "पहाड़गंज", "आईएनए",
  "खान मार्केट", "इंद्रप्रस्थ", "शाहदरा", "जहाँगीरपुरी", "पीतमपुरा",
  "नई दिल्ली", "गुड़गाँव", "नोएडा", "फरीदाबाद", "गाजियाबाद",
];

// Beijing/Chinese city areas for Chinese locale
const PLACE_POOL_ZH = [
  "王府井", "西单", "三里屯", "朝阳", "海淀", "丰台", "石景山",
  "通州", "顺义", "大兴", "房山", "密云", "怀柔", "延庆", "平谷",
  "昌平", "门头沟", "亦庄", "望京", "中关村", "五道口", "国贸",
  "建国门", "复兴门", "木樨地", "马甸", "知春路", "清河", "北京南", "天安门",
];

const PALETTES: TrailConfig["palette"][] = [
  {
    // Dark indigo — yellow forward, bright magenta backward
    bg: "#111827", bgGlow: "#312e81", panel: "#1f2937",
    trail: "#22d3ee", visited: "#facc15", repeated: "#e879f9",
    node: "#fb7185", text: "#fef3c7", accent: "#34d399",
  },
  {
    // Deep blue — lime green forward, hot orange backward
    bg: "#172554", bgGlow: "#1d4ed8", panel: "#1e3a8a",
    trail: "#60a5fa", visited: "#4ade80", repeated: "#fb923c",
    node: "#facc15", text: "#f8fafc", accent: "#22c55e",
  },
  {
    // Dark red — bright yellow forward, sky blue backward
    bg: "#3f0d12", bgGlow: "#7c2d12", panel: "#5b1220",
    trail: "#fb7185", visited: "#fde047", repeated: "#38bdf8",
    node: "#f59e0b", text: "#fff7ed", accent: "#4ade80",
  },
  {
    // Dark green — amber forward, bright violet backward
    bg: "#0f1a10", bgGlow: "#14532d", panel: "#1a2e1b",
    trail: "#4ade80", visited: "#fbbf24", repeated: "#a78bfa",
    node: "#34d399", text: "#f0fdf4", accent: "#86efac",
  },
];

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDecimal(min: number, max: number) {
  return Number((Math.round((Math.random() * (max - min) + min) * 10) / 10).toFixed(1));
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function routeDistance(route: number[], edges: TrailEdge[]) {
  let total = 0;
  for (let i = 1; i < route.length; i++) {
    const a = Math.min(route[i - 1], route[i]);
    total += edges[a].distance;
  }
  return Number(total.toFixed(1));
}

function buildL1Prompt(route: number[], stops: TrailStop[], dinoName: string, t: TFunction): {
  prompt: string; key: string; vars: Record<string, string | number>;
} {
  const names = route.map((i) => stops[i].label);
  if (names.length === 2) {
    const vars = { dino: dinoName, from: names[0], to: names[1] };
    return { prompt: t("game.prompt.l1TwoStop", vars), key: "game.prompt.l1TwoStop", vars };
  }
  const vars = { dino: dinoName, stops: names.join(t("game.stopSeparator")) };
  return { prompt: t("game.prompt.l1MultiStop", vars), key: "game.prompt.l1MultiStop", vars };
}

function buildQuestionRoute(stopCount: number, hopCount: number): number[] {
  const route = [randomInt(0, stopCount - 1)];
  while (route.length < hopCount + 1) {
    const cur = route[route.length - 1];
    const opts: number[] = [];
    if (cur > 0) opts.push(cur - 1);
    if (cur < stopCount - 1) opts.push(cur + 1);
    route.push(opts[randomInt(0, opts.length - 1)]);
  }
  return route;
}

export function generateTrailConfig(level = 1, locale = "en"): TrailConfig {
  // Level 2 needs more stops so questions can span up to 5 segments.
  const stopCount = level >= 2 ? randomInt(5, 6) : randomInt(3, 5);
  const pool = locale === "hi" ? PLACE_POOL_HI : locale === "zh" ? PLACE_POOL_ZH : PLACE_POOL;
  const labels = shuffle(pool).slice(0, stopCount);
  const palette = PALETTES[randomInt(0, PALETTES.length - 1)];
  const unit: "km" | "mi" = Math.random() > 0.45 ? "km" : "mi";

  const yOffsets = [0, ...Array.from({ length: stopCount - 2 }, () =>
    (Math.random() - 0.5) * 160
  ), 0];

  const stops: TrailStop[] = labels.map((label, i) => {
    const t = stopCount === 1 ? 0.5 : i / (stopCount - 1);
    return {
      id: `P${i}`,
      label,
      x: Math.round(110 + t * 1060),
      y: Math.round(340 + yOffsets[i]),
    };
  });

  const edges: TrailEdge[] = Array.from({ length: stopCount - 1 }, (_, i) => ({
    from: stops[i].id,
    to: stops[i + 1].id,
    distance: randomDecimal(1.5, unit === "km" ? 9.9 : 8.9),
  }));

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    unit, palette, stops, edges,
  };
}

// ─── Single-question generator (used after each correct/wrong answer) ────────

export function makeOneQuestion(config: TrailConfig, level: number, dinoName = "Rex", t: TFunction): TrailQuestion {
  if (level === 2) {
    const q = generateLevelTwoQuestions(config, 1, t);
    if (q.length) return q[0];
  }
  if (level === 3) {
    const q = generateLevelThreeQuestions(config, 1, t);
    if (q.length) return q[0];
  }
  return generateLevelOneQuestions(config, 1, dinoName, t)[0];
}

// ─── Level 1: find total distance ────────────────────────────────────────────

export function generateLevelOneQuestions(config: TrailConfig, count = 5, dinoName = "Rex", t: TFunction): TrailQuestion[] {
  const questions: TrailQuestion[] = [];
  const seen = new Set<string>();
  let attempts = 0;

  while (questions.length < count && attempts < 300) {
    attempts++;
    const hops = randomInt(1, Math.min(3, config.stops.length - 1));
    const route = buildQuestionRoute(config.stops.length, hops);
    const sig = route.join("-");
    if (seen.has(sig)) continue;
    seen.add(sig);
    const { prompt, key: promptKey, vars: promptVars } = buildL1Prompt(route, config.stops, dinoName, t);
    questions.push({
      id: `q1-${questions.length + 1}`,
      route,
      prompt,
      promptKey,
      promptVars,
      answer: routeDistance(route, config.edges),
    });
  }
  return questions;
}

// ─── Level 3: how much farther ───────────────────────────────────────────────

export function generateLevelThreeQuestions(config: TrailConfig, count = 5, t: TFunction): TrailQuestion[] {
  const n = config.stops.length;
  if (n < 3) return [];           // need at least 2 edges

  const questions: TrailQuestion[] = [];
  const seen = new Set<string>();
  let attempts = 0;

  while (questions.length < count && attempts < 300) {
    attempts++;
    // Pick a hub that has an edge on both sides: stop indices 1 … n-2
    const hub = randomInt(1, n - 2);
    const edgeLeft = hub - 1;   // edge between hub-1 and hub
    const edgeRight = hub;      // edge between hub and hub+1

    const sig = `h${hub}`;
    if (seen.has(sig)) continue;
    seen.add(sig);

    const distA = config.edges[edgeLeft].distance;   // hub ← left
    const distB = config.edges[edgeRight].distance;  // hub → right
    if (Math.abs(distA - distB) < 0.05) continue;   // skip if equal

    const hubName  = config.stops[hub].label;
    const leftName = config.stops[hub - 1].label;
    const rightName = config.stops[hub + 1].label;
    const [farName, nearName, farDist, nearDist] =
      distA >= distB
        ? [leftName, rightName, distA, distB]
        : [rightName, leftName, distB, distA];
    const answer = Number((farDist - nearDist).toFixed(1));

    const l3MainVars = { hub: hubName, far: farName, near: nearName };
    const l3LineVars: [Record<string, string>, Record<string, string>, Record<string, string>] = [
      { from: hubName, to: leftName },
      { from: hubName, to: rightName },
      l3MainVars,
    ];
    questions.push({
      id: `q3-${questions.length + 1}`,
      route: [hub - 1, hub, hub + 1],
      prompt: t("game.prompt.l3HowMuchFarther", l3MainVars),
      promptKey: "game.prompt.l3HowMuchFarther",
      promptVars: l3MainVars,
      answer,
      hubStop: hub,
      legA: edgeLeft,
      legB: edgeRight,
      promptLines: [
        t("game.prompt.l3SubFromTo", l3LineVars[0]),
        t("game.prompt.l3SubFromTo", l3LineVars[1]),
        t("game.prompt.l3HowMuchFarther", l3MainVars),
      ],
      promptLineKeys: ["game.prompt.l3SubFromTo", "game.prompt.l3SubFromTo", "game.prompt.l3HowMuchFarther"],
      promptLineVars: l3LineVars,
      subAnswers: [distA, distB, answer],
    });
  }
  return questions;
}

// ─── Level 2: find the missing leg ───────────────────────────────────────────

export function generateLevelTwoQuestions(config: TrailConfig, count = 5, t: TFunction): TrailQuestion[] {
  const n = config.stops.length;
  const questions: TrailQuestion[] = [];
  const seen = new Set<string>();
  let attempts = 0;

  while (questions.length < count && attempts < 300) {
    attempts++;
    // Route must have ≥ 2 edges so there's still one visible leg after hiding one.
    // Allow up to 5 segments; trail is generated with 5-6 stops for Level 2.
    const maxHops = Math.min(n - 1, 5);
    if (maxHops < 2) continue;
    const hopCount = randomInt(2, maxHops);
    const maxStart = n - 1 - hopCount;
    if (maxStart < 0) continue;
    const start = randomInt(0, maxStart);
    // Sequential forward route: 0,1,2,...
    const route: number[] = Array.from({ length: hopCount + 1 }, (_, i) => start + i);
    // Edge indices within this route = start, start+1, ..., start+hopCount-1
    const routeEdgeIndices = route.slice(0, -1).map((s) => s);
    const hiddenEdge = routeEdgeIndices[randomInt(0, routeEdgeIndices.length - 1)];

    const sig = `${route.join("-")}-h${hiddenEdge}`;
    if (seen.has(sig)) continue;
    seen.add(sig);

    const total = routeDistance(route, config.edges);
    const from = config.stops[route[0]].label;
    const to = config.stops[route[route.length - 1]].label;
    const hidFrom = config.stops[hiddenEdge].label;
    const hidTo = config.stops[hiddenEdge + 1].label;

    const l2Vars = { from, to, total: total.toFixed(1), unit: config.unit, hidFrom, hidTo };
    questions.push({
      id: `q2-${questions.length + 1}`,
      route,
      prompt: t("game.prompt.l2MissingLeg", l2Vars),
      promptKey: "game.prompt.l2MissingLeg",
      promptVars: l2Vars,
      answer: config.edges[hiddenEdge].distance,
      hiddenEdge,
      totalGiven: total,
    });
  }
  return questions;
}
