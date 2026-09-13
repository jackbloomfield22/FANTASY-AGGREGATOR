/**
 * Fantasy matchup win-probability estimate.
 *
 * This is an unofficial MVP heuristic, isolated here so a real model can
 * replace it later. If a fantasy provider supplies its own probability, use
 * that instead of calling this.
 */

export interface WinProbabilityInput {
  userScore: number;
  opponentScore: number;
  /** Expected FINAL scores: points already banked + remaining projection. */
  userProjected: number;
  opponentProjected: number;
  /** Game-time still to be played, summed over starters (1 = a full game). */
  userPlayersRemaining: number;
  opponentPlayersRemaining: number;
  matchupComplete: boolean;
}

/** Roughly one starter's full-game fantasy standard deviation. */
const SIGMA_PER_STARTER_GAME = 7.5;

export function estimateWinProbability(input: WinProbabilityInput): number {
  if (input.matchupComplete) {
    return input.userScore > input.opponentScore ? 1 : input.userScore < input.opponentScore ? 0 : 0.5;
  }

  // The expected-final margin already blends what's banked with what's
  // left; uncertainty comes only from the game-time still outstanding.
  const remainingTotal = Math.max(0, input.userPlayersRemaining + input.opponentPlayersRemaining);
  const margin = input.userProjected - input.opponentProjected;
  const sigma = Math.max(2.5, SIGMA_PER_STARTER_GAME * Math.sqrt(remainingTotal));
  const p = cdf(margin / sigma);
  return clamp(p, 0.01, 0.99);
}

/** Standard normal CDF (Abramowitz–Stegun approximation). */
function cdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  let p =
    d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  if (z > 0) p = 1 - p;
  return p;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
