import { PALETTES, PLACE_POOL, PLACE_POOL_HI, PLACE_POOL_ZH, randomDecimal, randomInt, shuffle } from "./shared.ts";
import type { TrailConfig, TrailStop } from "./types.ts";

/**
 * Builds the procedural trail used by every level and round. The injected random
 * source lets the unit tests reproduce exact maps and distances.
 */
export function generateTrailConfig(
  level = 1,
  locale = "en",
  random: () => number = Math.random,
): TrailConfig {
  const stopCount = level >= 2 ? randomInt(5, 6, random) : randomInt(3, 5, random);
  const pool =
    locale === "hi"
      ? PLACE_POOL_HI
      : locale === "zh"
        ? PLACE_POOL_ZH
        : PLACE_POOL;
  const labels = shuffle(pool, random).slice(0, stopCount);
  const palette = PALETTES[randomInt(0, PALETTES.length - 1, random)];
  const unit: "km" | "mi" = random() > 0.45 ? "km" : "mi";

  const yOffsets = [
    0,
    ...Array.from({ length: stopCount - 2 }, () => (random() - 0.5) * 160),
    0,
  ];

  const stops: TrailStop[] = labels.map((label, index) => {
    const t = stopCount === 1 ? 0.5 : index / (stopCount - 1);
    return {
      id: `P${index}`,
      label,
      x: Math.round(110 + t * 1060),
      y: Math.round(340 + yOffsets[index]),
    };
  });

  const edges = Array.from({ length: stopCount - 1 }, (_, index) => ({
    from: stops[index].id,
    to: stops[index + 1].id,
    distance:
      level <= 2
        ? randomInt(2, unit === "km" ? 9 : 8, random)
        : randomDecimal(1.5, unit === "km" ? 9.9 : 8.9, random),
  }));

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    unit,
    palette,
    stops,
    edges,
  };
}
