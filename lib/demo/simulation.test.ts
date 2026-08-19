import { describe, expect, it } from "vitest";
import { buildDemoSnapshot, DEMO_CYCLE_SECONDS } from "./simulation";
import { aggregatePortfolio } from "@/lib/portfolio/aggregate";
import { pid } from "./data";

const NOW = Date.UTC(2026, 0, 4, 18, 10, 0); // 600s into the cycle

describe("demo snapshot", () => {
  it("is deterministic for the same instant", () => {
    const a = buildDemoSnapshot(NOW);
    const b = buildDemoSnapshot(NOW);
    expect(JSON.stringify(a.games)).toBe(JSON.stringify(b.games));
    expect(JSON.stringify(a.playerStats)).toBe(JSON.stringify(b.playerStats));
  });

  it("progresses over time: scores and stats move forward", () => {
    const early = buildDemoSnapshot(NOW);
    const later = buildDemoSnapshot(NOW + 1500 * 1000);
    const g1Early = early.games.find((g) => g.id === "g-lar-sea")!;
    const g1Later = later.games.find((g) => g.id === "g-lar-sea")!;
    expect(g1Later.awayScore).toBeGreaterThan(g1Early.awayScore);
    const reedEarly = early.playerStats.find((s) => s.playerId === pid("Marcus Reed"))!;
    const reedLater = later.playerStats.find((s) => s.playerId === pid("Marcus Reed"))!;
    expect(reedLater.stats.rec_yd!).toBeGreaterThan(reedEarly.stats.rec_yd!);
  });

  it("contains the seeded shape: 5 leagues, live + red zone + final + upcoming games", () => {
    // 60s into the cycle: the scripted LAR red-zone drive is active.
    const snap = buildDemoSnapshot(Date.UTC(2026, 0, 4, 18, 1, 0));
    expect(snap.leagues).toHaveLength(5);
    expect(snap.matchups).toHaveLength(5);
    expect(snap.games.filter((g) => g.status === "live").length).toBeGreaterThanOrEqual(3);
    expect(snap.games.filter((g) => g.status === "final").length).toBeGreaterThanOrEqual(3);
    expect(snap.games.filter((g) => g.status === "scheduled").length).toBeGreaterThanOrEqual(2);
    expect(snap.games.some((g) => g.redZone)).toBe(true);
  });

  it("loops cleanly across cycle boundaries", () => {
    const snap = buildDemoSnapshot(NOW + DEMO_CYCLE_SECONDS * 1000);
    const g1 = snap.games.find((g) => g.id === "g-lar-sea")!;
    expect(g1.status).toBe("live"); // back to the start of the script
  });
});

describe("aggregated demo portfolio", () => {
  const agg = aggregatePortfolio(buildDemoSnapshot(NOW));

  it("normalizes duplicate ownership into one canonical player", () => {
    const reeds = agg.players.filter((p) => p.player.id === pid("Marcus Reed"));
    expect(reeds).toHaveLength(1);
    const reed = reeds[0];
    expect(reed.rosteredCount).toBe(3);
    expect(reed.starterCount).toBe(2);
    expect(reed.totalLeagues).toBe(5);
    expect(reed.rosterExposure).toBeCloseTo(0.6);
    expect(reed.starterExposure).toBeCloseTo(0.4);
  });

  it("computes different fantasy points per league for the same stat line", () => {
    const reed = agg.players.find((p) => p.player.id === pid("Marcus Reed"))!;
    const byLeague = new Map(reed.leagues.map((l) => [l.leagueId, l.points]));
    // Office = PPR, Dynasty = half PPR: same raw stats, different points.
    expect(byLeague.get("lg-office")).toBeGreaterThan(byLeague.get("lg-dynasty")!);
  });

  it("portfolio impact excludes bench points", () => {
    const reed = agg.players.find((p) => p.player.id === pid("Marcus Reed"))!;
    const starterSum = reed.leagues
      .filter((l) => l.isStarter)
      .reduce((s, l) => s + l.points, 0);
    expect(reed.portfolioImpact).toBeCloseTo(Math.round(starterSum * 10) / 10);
    const benchSum = reed.leagues.filter((l) => !l.isStarter).reduce((s, l) => s + l.points, 0);
    expect(reed.benchPoints).toBeCloseTo(Math.round(benchSum * 10) / 10);
    expect(reed.portfolioImpact + reed.benchPoints).toBeGreaterThan(reed.portfolioImpact);
  });

  it("ranks games with more starters above bench-only games", () => {
    const withExposure = agg.games.filter((g) => g.players.length > 0);
    expect(withExposure.length).toBeGreaterThan(3);
    for (let i = 1; i < withExposure.length; i++) {
      expect(withExposure[i - 1].importanceScore).toBeGreaterThanOrEqual(
        withExposure[i].importanceScore
      );
    }
  });

  it("produces five matchup views with win probabilities", () => {
    expect(agg.matchups).toHaveLength(5);
    for (const m of agg.matchups) {
      expect(m.matchup.winProbability).not.toBeNull();
      expect(m.matchup.winProbability!).toBeGreaterThan(0);
      expect(m.matchup.winProbability!).toBeLessThan(1);
    }
  });

  it("summarizes the Sunday", () => {
    expect(agg.summary.leagues).toBe(5);
    expect(agg.summary.uniquePlayers).toBeGreaterThanOrEqual(30);
    expect(agg.summary.liveNow).toBeGreaterThan(0);
    expect(agg.summary.gamesLive).toBeGreaterThanOrEqual(3);
    expect(agg.mostImportantGame).not.toBeNull();
    expect(agg.biggestSwing).not.toBeNull();
  });
});
