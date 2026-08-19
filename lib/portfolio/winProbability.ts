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
  userProjected: number;
  opponentProjected: number;
  userPlayersRemaining: number;
  opponentPlayersRemaining: number;
  matchupComplete: boolean;
}

export function estimateWinProbability(input: WinProbabilityInput): number {
  if (input.matchupComplete) {
    return input.userScore > input.opponentScore ? 1 : input.userScore < input.opponentScore ? 0 : 0.5;
  }

  // Blend current margin with projected margin, weighted by how much of the
  // matchup is still outstanding.
  const remainingTotal = input.userPlayersRemaining + input.opponentPlayersRemaining;
  const projWeight = Math.min(1, remainingTotal / 10); // more players left -> trust projections more
  const currentMargin = input.userScore - input.opponentScore;
  const projectedMargin = input.userProjected - input.opponentProjected;
  const blendedMargin = currentMargin * (1 - projWeight) + projectedMargin * projWeight;

  // Uncertainty scales with players remaining; ~12 fantasy points of sigma
  // per outstanding starter is a rough but sane MVP figure.
  const sigma = Math.max(6, Math.sqrt(Math.max(1, remainingTotal)) * 9);
  const z = blendedMargin / sigma;
  const p = cdf(z);
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
