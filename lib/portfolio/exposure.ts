import type { PlayerLeagueContext } from "@/lib/types";

/**
 * Exposure + portfolio impact math. Pure functions, unit tested.
 */

/** leagues where rostered / total leagues -> 0..1 */
export function rosterExposure(rosteredCount: number, totalLeagues: number): number {
  if (totalLeagues <= 0) return 0;
  return rosteredCount / totalLeagues;
}

/** leagues where starting / total leagues -> 0..1 */
export function starterExposure(starterCount: number, totalLeagues: number): number {
  if (totalLeagues <= 0) return 0;
  return starterCount / totalLeagues;
}

/**
 * Active portfolio impact: sum of fantasy points across leagues where the
 * user STARTS the player. Bench points are excluded (reported separately).
 */
export function portfolioImpact(contexts: PlayerLeagueContext[]): number {
  return round1(
    contexts.filter((c) => c.isStarter).reduce((sum, c) => sum + c.points, 0)
  );
}

/** Bench-only points, kept separate from active impact. */
export function benchPoints(contexts: PlayerLeagueContext[]): number {
  return round1(
    contexts.filter((c) => !c.isStarter).reduce((sum, c) => sum + c.points, 0)
  );
}

export function formatExposure(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
