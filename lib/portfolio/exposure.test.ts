import { describe, expect, it } from "vitest";
import { benchPoints, formatExposure, portfolioImpact, rosterExposure, starterExposure } from "./exposure";
import type { PlayerLeagueContext } from "@/lib/types";

const ctx = (leagueId: string, isStarter: boolean, points: number): PlayerLeagueContext => ({
  leagueId,
  leagueName: leagueId,
  scoringType: "ppr",
  isStarter,
  slot: isStarter ? "WR" : "BN",
  points,
  projectedPoints: null,
});

describe("exposure", () => {
  it("computes roster exposure: 3 of 5 leagues = 60%", () => {
    expect(rosterExposure(3, 5)).toBe(0.6);
    expect(formatExposure(rosterExposure(3, 5))).toBe("60%");
  });

  it("computes starter exposure: 2 of 5 leagues = 40%", () => {
    expect(starterExposure(2, 5)).toBe(0.4);
    expect(formatExposure(starterExposure(2, 5))).toBe("40%");
  });

  it("handles zero leagues without dividing by zero", () => {
    expect(rosterExposure(0, 0)).toBe(0);
    expect(starterExposure(0, 0)).toBe(0);
  });
});

describe("portfolioImpact", () => {
  it("sums only starting-lineup points; bench excluded", () => {
    const contexts = [
      ctx("A", true, 20.4),
      ctx("B", true, 24.4),
      ctx("C", false, 20.4),
    ];
    expect(portfolioImpact(contexts)).toBe(44.8);
    expect(portfolioImpact(contexts)).not.toBe(65.2);
  });

  it("reports bench points separately", () => {
    const contexts = [ctx("A", true, 20.4), ctx("C", false, 20.4), ctx("D", false, 10)];
    expect(benchPoints(contexts)).toBe(30.4);
  });

  it("preserves scoring differences between leagues in the sum", () => {
    // Same raw performance, different league scoring -> different points.
    const contexts = [ctx("A", true, 22.4), ctx("B", true, 26.4)];
    expect(portfolioImpact(contexts)).toBe(48.8);
  });
});
