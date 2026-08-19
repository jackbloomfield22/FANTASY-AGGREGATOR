/**
 * NFL game importance ranking.
 *
 * The formula is deliberately isolated so it can be tuned later without
 * touching UI code.
 */

export interface GameExposureInput {
  starterCount: number;
  benchCount: number;
  isLive?: boolean;
  isRedZone?: boolean;
}

/** starters * 2 + bench, with small live/red-zone boosts for sorting. */
export function gameImportanceScore(input: GameExposureInput): number {
  const base = input.starterCount * 2 + input.benchCount;
  let boost = 0;
  if (input.isLive) boost += 0.5;
  if (input.isRedZone && input.starterCount > 0) boost += 0.25;
  return base + boost;
}

export function exposureLevel(
  starterCount: number,
  benchCount: number
): "high" | "medium" | "low" | "none" {
  if (starterCount >= 4) return "high";
  if (starterCount >= 2) return "medium";
  if (starterCount + benchCount > 0) return "low";
  return "none";
}
