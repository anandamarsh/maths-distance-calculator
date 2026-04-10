import type { TFunction } from "../i18n/types.ts";
import type { TrailConfig, TrailEdge, TrailQuestion, TrailStop } from "./types.ts";

export const PLACE_POOL = [
  "Newtown", "Ashfield", "Marrickville", "Leichhardt", "Erskineville",
  "Redfern", "Tempe", "Sydenham", "Enmore", "Stanmore",
  "Petersham", "Dulwich", "Rozelle", "Balmain", "Drummoyne",
  "Concord", "Rhodes", "Burwood", "Strathfield", "Homebush",
  "Croydon", "Lidcombe", "Bankstown", "Lakemba", "Belmore",
  "Hurstville", "Kogarah", "Rockdale", "Sylvania", "Miranda",
] as const;

export const PLACE_POOL_HI = [
  "कनॉट प्लेस", "लाजपत नगर", "करोल बाग", "चाँदनी चौक", "सरोजिनी नगर",
  "नेहरू प्लेस", "द्वारका", "रोहिणी", "पटेल नगर", "जनकपुरी",
  "सफदरजंग", "लोधी रोड", "मयूर विहार", "वसंत कुंज", "मालवीय नगर",
  "हौज खास", "साकेत", "राजेंद्र नगर", "पहाड़गंज", "आईएनए",
  "खान मार्केट", "इंद्रप्रस्थ", "शाहदरा", "जहाँगीरपुरी", "पीतमपुरा",
  "नई दिल्ली", "गुड़गाँव", "नोएडा", "फरीदाबाद", "गाजियाबाद",
] as const;

export const PLACE_POOL_ZH = [
  "人民广场", "南京东路", "陆家嘴", "徐家汇", "静安寺",
  "虹桥", "浦东", "张江", "闵行", "宝山",
  "嘉定", "松江", "青浦", "奉贤", "金山",
  "外滩", "新天地", "衡山路", "淮海路", "四川北路",
  "曹家渡", "中山公园", "长寿路", "延安路", "江湾",
  "杨浦", "五角场", "龙阳路", "莘庄", "虹桥机场",
] as const;

export const PALETTES: TrailConfig["palette"][] = [
  {
    bg: "#111827", bgGlow: "#312e81", panel: "#1f2937",
    trail: "#22d3ee", visited: "#facc15", repeated: "#e879f9",
    node: "#fb7185", text: "#fef3c7", accent: "#34d399",
  },
  {
    bg: "#172554", bgGlow: "#1d4ed8", panel: "#1e3a8a",
    trail: "#60a5fa", visited: "#4ade80", repeated: "#fb923c",
    node: "#facc15", text: "#f8fafc", accent: "#22c55e",
  },
  {
    bg: "#3f0d12", bgGlow: "#7c2d12", panel: "#5b1220",
    trail: "#fb7185", visited: "#fde047", repeated: "#38bdf8",
    node: "#f59e0b", text: "#fff7ed", accent: "#4ade80",
  },
  {
    bg: "#0f1a10", bgGlow: "#14532d", panel: "#1a2e1b",
    trail: "#4ade80", visited: "#fbbf24", repeated: "#a78bfa",
    node: "#34d399", text: "#f0fdf4", accent: "#86efac",
  },
];

export function randomInt(min: number, max: number, random: () => number = Math.random): number {
  return Math.floor(random() * (max - min + 1)) + min;
}

export function randomDecimal(min: number, max: number, random: () => number = Math.random): number {
  return Number((Math.round((random() * (max - min) + min) * 10) / 10).toFixed(1));
}

export function shuffle<T>(arr: readonly T[], random: () => number = Math.random): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Adds the labelled distances along the route. The route may move forwards or
 * backwards, so each edge index is taken from the lower stop index.
 */
export function routeDistance(route: number[], edges: TrailEdge[]): number {
  let total = 0;
  for (let i = 1; i < route.length; i += 1) {
    const edgeIndex = Math.min(route[i - 1], route[i]);
    total += edges[edgeIndex].distance;
  }
  return Number(total.toFixed(1));
}

/**
 * Builds a walk along adjacent stops only. This mirrors the live game where the
 * dino travels edge by edge rather than jumping across the map.
 */
export function buildQuestionRoute(
  stopCount: number,
  hopCount: number,
  random: () => number = Math.random,
): number[] {
  const route = [randomInt(0, stopCount - 1, random)];
  while (route.length < hopCount + 1) {
    const currentStop = route[route.length - 1];
    const options: number[] = [];
    if (currentStop > 0) {
      options.push(currentStop - 1);
    }
    if (currentStop < stopCount - 1) {
      options.push(currentStop + 1);
    }
    route.push(options[randomInt(0, options.length - 1, random)]);
  }
  return route;
}

export function createQuestionId(prefix: string, index: number): string {
  return `${prefix}-${index}`;
}

export function buildL1Prompt(
  route: number[],
  stops: TrailStop[],
  dinoName: string,
  t: TFunction,
): { prompt: string; key: string; vars: Record<string, string | number> } {
  const names = route.map((index) => stops[index].label);
  if (names.length === 2) {
    const vars = { dino: dinoName, from: names[0], to: names[1] };
    return { prompt: t("game.prompt.l1TwoStop", vars), key: "game.prompt.l1TwoStop", vars };
  }
  const vars = { dino: dinoName, stops: names.join(t("game.stopSeparator")) };
  return { prompt: t("game.prompt.l1MultiStop", vars), key: "game.prompt.l1MultiStop", vars };
}

export function createSingleQuestion(
  questions: TrailQuestion[],
  errorMessage: string,
): TrailQuestion {
  const firstQuestion = questions[0];
  if (!firstQuestion) {
    throw new Error(errorMessage);
  }
  return firstQuestion;
}
