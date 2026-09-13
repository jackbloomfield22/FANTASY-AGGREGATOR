import { describe, expect, it } from "vitest";
import { estimateWinProbability } from "./winProbability";

const base = {
  userScore: 0,
  opponentScore: 0,
  userProjected: 120,
  opponentProjected: 110,
  userPlayersRemaining: 9,
  opponentPlayersRemaining: 9,
  matchupComplete: false,
};

describe("estimateWinProbability", () => {
  it("favours the higher expected final, modestly before kickoff", () => {
    const p = estimateWinProbability(base);
    expect(p).toBeGreaterThan(0.55);
    expect(p).toBeLessThan(0.7);
  });

  it("grows more certain as game-time runs out with the same margin", () => {
    const early = estimateWinProbability(base);
    const late = estimateWinProbability({
      ...base,
      userScore: 100,
      opponentScore: 90,
      userProjected: 112,
      opponentProjected: 102,
      userPlayersRemaining: 1,
      opponentPlayersRemaining: 1,
    });
    expect(late).toBeGreaterThan(early);
  });

  it("is decided once the matchup is complete", () => {
    expect(estimateWinProbability({ ...base, userScore: 101, opponentScore: 100, matchupComplete: true })).toBe(1);
    expect(estimateWinProbability({ ...base, userScore: 99, opponentScore: 100, matchupComplete: true })).toBe(0);
  });
});
