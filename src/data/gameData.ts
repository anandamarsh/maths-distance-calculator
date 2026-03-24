export interface MapNode {
  id: string;
  emoji: string;
  label: string;
  x: number;
  y: number;
}

export interface MapEdge {
  from: string;
  to: string;
  distance: number | string;
  highlight?: boolean;
}

export interface GameMap {
  nodes: MapNode[];
  edges: MapEdge[];
  totalLabel?: string; // for missing-segment maps
}

export interface Question {
  id: string;
  text: string;
  map: GameMap;
  options: string[];
  correct: string;
  hint: string;
  solution: string;
}

export interface Level {
  id: number;
  title: string;
  emoji: string;
  color: string;
  bg: string;
  border: string;
  challenge: string;
  tip: string;
  questions: Question[];
}

export const LEVELS: Level[] = [
  {
    id: 1,
    title: "Trace the Trail",
    emoji: "🦕",
    color: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    challenge: "Rex needs to travel between islands — but he keeps adding the wrong distances!",
    tip: "👆 Trace your finger from START to END. Say each distance out loud. Then add them ALL up.",
    questions: [
      {
        id: "1-1",
        text: "Rex walks from his Nest 🥚 to the Swamp, then to the Volcano. What is the TOTAL distance?",
        map: {
          nodes: [
            { id: "A", emoji: "🥚", label: "Nest", x: 50, y: 90 },
            { id: "B", emoji: "🌿", label: "Swamp", x: 160, y: 90 },
            { id: "C", emoji: "🌋", label: "Volcano", x: 270, y: 90 },
          ],
          edges: [
            { from: "A", to: "B", distance: 1.4, highlight: true },
            { from: "B", to: "C", distance: 2.3, highlight: true },
          ],
        },
        options: ["3.7 km", "2.3 km", "3.4 km", "4.1 km"],
        correct: "3.7 km",
        hint: "Trace the whole path: Nest → Swamp → Volcano. Add 1.4 + 2.3.",
        solution: "1.4 + 2.3 = 3.7 km ✅",
      },
      {
        id: "1-2",
        text: "Rex races from the Beach to the Jungle, then on to the Crystal Cave. How far did he run?",
        map: {
          nodes: [
            { id: "A", emoji: "🏖️", label: "Beach", x: 50, y: 90 },
            { id: "B", emoji: "🌴", label: "Jungle", x: 160, y: 90 },
            { id: "C", emoji: "💎", label: "Cave", x: 270, y: 90 },
          ],
          edges: [
            { from: "A", to: "B", distance: 3.2, highlight: true },
            { from: "B", to: "C", distance: 2.5, highlight: true },
          ],
        },
        options: ["5.7 km", "3.2 km", "5.2 km", "6.2 km"],
        correct: "5.7 km",
        hint: "Follow the path all the way to the end: 3.2 + 2.5.",
        solution: "3.2 + 2.5 = 5.7 km ✅",
      },
      {
        id: "1-3",
        text: "Rex must go from the River to the Hot Spring, then to the Dino Eggs. What's the full distance?",
        map: {
          nodes: [
            { id: "A", emoji: "🏞️", label: "River", x: 50, y: 90 },
            { id: "B", emoji: "♨️", label: "Hot Spring", x: 160, y: 90 },
            { id: "C", emoji: "🥚", label: "Eggs", x: 270, y: 90 },
          ],
          edges: [
            { from: "A", to: "B", distance: 2.8, highlight: true },
            { from: "B", to: "C", distance: 1.9, highlight: true },
          ],
        },
        options: ["4.7 km", "1.9 km", "4.2 km", "5.1 km"],
        correct: "4.7 km",
        hint: "Both segments are on the route: 2.8 + 1.9.",
        solution: "2.8 + 1.9 = 4.7 km ✅",
      },
    ],
  },

  {
    id: 2,
    title: "Missing Map Piece",
    emoji: "🗺️",
    color: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-200",
    challenge: "Part of Rex's map got chewed up! One distance is missing — can you find it?",
    tip: "🔑 You know the TOTAL. Subtract all the known pieces. What's left is the missing one!",
    questions: [
      {
        id: "2-1",
        text: "Rex's whole trip is 8.5 km. He walks 3.2 km to the Lake, then 2.1 km to the Swamp. How far is the LAST stretch to the Volcano?",
        map: {
          nodes: [
            { id: "A", emoji: "🏕️", label: "Camp", x: 40, y: 90 },
            { id: "B", emoji: "💧", label: "Lake", x: 130, y: 90 },
            { id: "C", emoji: "🌿", label: "Swamp", x: 220, y: 90 },
            { id: "D", emoji: "🌋", label: "Volcano", x: 300, y: 90 },
          ],
          edges: [
            { from: "A", to: "B", distance: 3.2 },
            { from: "B", to: "C", distance: 2.1 },
            { from: "C", to: "D", distance: "?" , highlight: true},
          ],
          totalLabel: "Total trip = 8.5 km",
        },
        options: ["3.2 km", "2.8 km", "3.7 km", "5.3 km"],
        correct: "3.2 km",
        hint: "Total − known pieces: 8.5 − 3.2 − 2.1 = ?",
        solution: "8.5 − 3.2 − 2.1 = 3.2 km ✅",
      },
      {
        id: "2-2",
        text: "Rex travels 10.4 km in total. The first stretch is 4.7 km and the second is 2.9 km. What is the missing final stretch?",
        map: {
          nodes: [
            { id: "A", emoji: "🥚", label: "Nest", x: 40, y: 90 },
            { id: "B", emoji: "🌴", label: "Palm", x: 140, y: 90 },
            { id: "C", emoji: "🏔️", label: "Peak", x: 230, y: 90 },
            { id: "D", emoji: "💎", label: "Cave", x: 310, y: 90 },
          ],
          edges: [
            { from: "A", to: "B", distance: 4.7 },
            { from: "B", to: "C", distance: 2.9 },
            { from: "C", to: "D", distance: "?", highlight: true },
          ],
          totalLabel: "Total trip = 10.4 km",
        },
        options: ["2.8 km", "3.4 km", "7.6 km", "1.8 km"],
        correct: "2.8 km",
        hint: "10.4 − 4.7 − 2.9 = ?",
        solution: "10.4 − 4.7 − 2.9 = 2.8 km ✅",
      },
      {
        id: "2-3",
        text: "Rex's total journey is 7.6 km. He has already walked the first 3.8 km. How far is the rest of the trip?",
        map: {
          nodes: [
            { id: "A", emoji: "🏕️", label: "Start", x: 60, y: 90 },
            { id: "B", emoji: "🌊", label: "Shore", x: 180, y: 90 },
            { id: "C", emoji: "🌋", label: "Finish", x: 290, y: 90 },
          ],
          edges: [
            { from: "A", to: "B", distance: 3.8 },
            { from: "B", to: "C", distance: "?", highlight: true },
          ],
          totalLabel: "Total trip = 7.6 km",
        },
        options: ["3.8 km", "4.2 km", "3.2 km", "5.1 km"],
        correct: "3.8 km",
        hint: "7.6 − 3.8 = ?",
        solution: "7.6 − 3.8 = 3.8 km ✅",
      },
    ],
  },

  {
    id: 3,
    title: "Route Race",
    emoji: "⚡",
    color: "text-blue-700",
    bg: "bg-blue-50",
    border: "border-blue-200",
    challenge: "Two routes go to the same place. Rex needs to know how far apart the totals are!",
    tip: "📋 Calculate Route A's FULL total. Then Route B's FULL total. Only then subtract!",
    questions: [
      {
        id: "3-1",
        text: "Route A goes 2.3 km + 3.1 km. Route B goes 1.8 km + 4.2 km. How much FARTHER is Route B?",
        map: {
          nodes: [
            { id: "S", emoji: "🏕️", label: "Start", x: 40, y: 90 },
            { id: "A", emoji: "🌴", label: "Via A", x: 170, y: 35 },
            { id: "B", emoji: "🌿", label: "Via B", x: 170, y: 145 },
            { id: "E", emoji: "🌋", label: "Volcano", x: 300, y: 90 },
          ],
          edges: [
            { from: "S", to: "A", distance: 2.3 },
            { from: "A", to: "E", distance: 3.1 },
            { from: "S", to: "B", distance: 1.8, highlight: true },
            { from: "B", to: "E", distance: 4.2, highlight: true },
          ],
        },
        options: ["0.6 km", "1.4 km", "0.9 km", "1.1 km"],
        correct: "0.6 km",
        hint: "Route A total = 2.3+3.1 = 5.4 km. Route B total = 1.8+4.2 = 6.0 km. Difference = 6.0−5.4.",
        solution: "Route A: 2.3+3.1 = 5.4 km | Route B: 1.8+4.2 = 6.0 km | 6.0−5.4 = 0.6 km ✅",
      },
      {
        id: "3-2",
        text: "Route A is 4.2 km + 1.5 km. Route B is 2.8 km + 3.4 km. Which is shorter, and by how much?",
        map: {
          nodes: [
            { id: "S", emoji: "🥚", label: "Nest", x: 40, y: 90 },
            { id: "A", emoji: "🏔️", label: "Peak", x: 170, y: 35 },
            { id: "B", emoji: "💧", label: "Lake", x: 170, y: 145 },
            { id: "E", emoji: "💎", label: "Cave", x: 300, y: 90 },
          ],
          edges: [
            { from: "S", to: "A", distance: 4.2, highlight: true },
            { from: "A", to: "E", distance: 1.5, highlight: true },
            { from: "S", to: "B", distance: 2.8 },
            { from: "B", to: "E", distance: 3.4 },
          ],
        },
        options: ["Route A by 0.5 km", "Route B by 0.5 km", "Route A by 0.4 km", "Same distance"],
        correct: "Route A by 0.5 km",
        hint: "Route A total = 4.2+1.5 = 5.7 km. Route B total = 2.8+3.4 = 6.2 km. Which is less?",
        solution: "Route A: 4.2+1.5 = 5.7 km | Route B: 2.8+3.4 = 6.2 km | Route A is shorter by 0.5 km ✅",
      },
      {
        id: "3-3",
        text: "South path: 3.4 km + 2.8 km. North path: 2.1 km + 3.7 km. How much farther is the South path?",
        map: {
          nodes: [
            { id: "S", emoji: "🏕️", label: "Home", x: 40, y: 90 },
            { id: "A", emoji: "🌊", label: "North", x: 170, y: 35 },
            { id: "B", emoji: "🌵", label: "South", x: 170, y: 145 },
            { id: "E", emoji: "🌋", label: "Volcano", x: 300, y: 90 },
          ],
          edges: [
            { from: "S", to: "A", distance: 2.1 },
            { from: "A", to: "E", distance: 3.7 },
            { from: "S", to: "B", distance: 3.4, highlight: true },
            { from: "B", to: "E", distance: 2.8, highlight: true },
          ],
        },
        options: ["0.4 km", "1.3 km", "0.9 km", "0.6 km"],
        correct: "0.4 km",
        hint: "South total = 3.4+2.8 = 6.2 km. North total = 2.1+3.7 = 5.8 km. Difference = 6.2−5.8.",
        solution: "South: 3.4+2.8 = 6.2 km | North: 2.1+3.7 = 5.8 km | 6.2−5.8 = 0.4 km ✅",
      },
    ],
  },

  {
    id: 4,
    title: "Shortest Shortcut",
    emoji: "🏆",
    color: "text-purple-700",
    bg: "bg-purple-50",
    border: "border-purple-200",
    challenge: "Rex wants to get to the treasure FAST. There are 3 routes — which is the shortest?",
    tip: "📝 List ALL routes. Calculate EACH total. Then pick the SMALLEST number.",
    questions: [
      {
        id: "4-1",
        text: "Route A = 2.1+3.4 km. Route B = 4.2+1.8 km. Route C = 1.9+3.2 km. Which route is shortest?",
        map: {
          nodes: [
            { id: "S", emoji: "🥚", label: "Nest", x: 40, y: 90 },
            { id: "A", emoji: "🌴", label: "Route A", x: 170, y: 20 },
            { id: "B", emoji: "🌊", label: "Route B", x: 170, y: 90 },
            { id: "C", emoji: "🌵", label: "Route C", x: 170, y: 160 },
            { id: "E", emoji: "💰", label: "Treasure", x: 300, y: 90 },
          ],
          edges: [
            { from: "S", to: "A", distance: 2.1 },
            { from: "A", to: "E", distance: 3.4 },
            { from: "S", to: "B", distance: 4.2 },
            { from: "B", to: "E", distance: 1.8 },
            { from: "S", to: "C", distance: 1.9, highlight: true },
            { from: "C", to: "E", distance: 3.2, highlight: true },
          ],
        },
        options: ["Route A (5.5 km)", "Route B (6.0 km)", "Route C (5.1 km)", "Route A (4.5 km)"],
        correct: "Route C (5.1 km)",
        hint: "A = 2.1+3.4 = 5.5 km | B = 4.2+1.8 = 6.0 km | C = 1.9+3.2 = 5.1 km. Smallest?",
        solution: "A=5.5 km | B=6.0 km | C=5.1 km → Route C is shortest ✅",
      },
      {
        id: "4-2",
        text: "Route A = 3.5+2.8 km. Route B = 2.4+3.6 km. Route C = 4.1+2.3 km. Pick the shortest!",
        map: {
          nodes: [
            { id: "S", emoji: "🏕️", label: "Camp", x: 40, y: 90 },
            { id: "A", emoji: "🏔️", label: "Route A", x: 170, y: 20 },
            { id: "B", emoji: "💧", label: "Route B", x: 170, y: 90 },
            { id: "C", emoji: "🌿", label: "Route C", x: 170, y: 160 },
            { id: "E", emoji: "🦕", label: "Rex Home", x: 300, y: 90 },
          ],
          edges: [
            { from: "S", to: "A", distance: 3.5 },
            { from: "A", to: "E", distance: 2.8 },
            { from: "S", to: "B", distance: 2.4, highlight: true },
            { from: "B", to: "E", distance: 3.6, highlight: true },
            { from: "S", to: "C", distance: 4.1 },
            { from: "C", to: "E", distance: 2.3 },
          ],
        },
        options: ["Route A (6.3 km)", "Route B (6.0 km)", "Route C (6.4 km)", "Route A (5.8 km)"],
        correct: "Route B (6.0 km)",
        hint: "A = 3.5+2.8 = 6.3 km | B = 2.4+3.6 = 6.0 km | C = 4.1+2.3 = 6.4 km. Smallest?",
        solution: "A=6.3 km | B=6.0 km | C=6.4 km → Route B is shortest ✅",
      },
      {
        id: "4-3",
        text: "Route A = 5.2+1.6 km. Route B = 3.1+4.0 km. Route C = 2.7+3.8 km. Which is shortest?",
        map: {
          nodes: [
            { id: "S", emoji: "🌋", label: "Volcano", x: 40, y: 90 },
            { id: "A", emoji: "🌴", label: "Route A", x: 170, y: 20 },
            { id: "B", emoji: "🌊", label: "Route B", x: 170, y: 90 },
            { id: "C", emoji: "♨️", label: "Route C", x: 170, y: 160 },
            { id: "E", emoji: "💎", label: "Gems", x: 300, y: 90 },
          ],
          edges: [
            { from: "S", to: "A", distance: 5.2 },
            { from: "A", to: "E", distance: 1.6 },
            { from: "S", to: "B", distance: 3.1 },
            { from: "B", to: "E", distance: 4.0 },
            { from: "S", to: "C", distance: 2.7, highlight: true },
            { from: "C", to: "E", distance: 3.8, highlight: true },
          ],
        },
        options: ["Route A (6.8 km)", "Route B (7.1 km)", "Route C (6.5 km)", "Route B (6.8 km)"],
        correct: "Route C (6.5 km)",
        hint: "A = 5.2+1.6 = 6.8 km | B = 3.1+4.0 = 7.1 km | C = 2.7+3.8 = 6.5 km. Smallest?",
        solution: "A=6.8 km | B=7.1 km | C=6.5 km → Route C is shortest ✅",
      },
    ],
  },
];
