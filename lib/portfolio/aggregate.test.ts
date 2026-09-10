import { describe, expect, it } from "vitest";
import type { PortfolioSnapshot } from "@/lib/types";
import { aggregatePortfolio } from "./aggregate";

/**
 * Projections + schedule-less degraded mode: even when Sleeper's schedule
 * feed returns nothing, stats presence must still tell an honest story and
 * projections must be scored under each league's own settings.
 */

function makeSnapshot(overrides?: Partial<PortfolioSnapshot>): PortfolioSnapshot {
  return {
    meta: {
      mode: "live",
      fantasySource: "sleeper",
      liveSource: "sleeper",
      week: 1,
      season: 2026,
      generatedAt: new Date().toISOString(),
      connections: [],
    },
    leagues: [
      {
        id: "L1",
        provider: "sleeper",
        providerLeagueId: "L1",
        name: "PPR League",
        season: 2026,
        week: 1,
        totalTeams: 10,
        scoringType: "ppr",
        scoringSettings: { rec: 1, rec_yd: 0.1, rec_td: 6 },
        lastSyncedAt: null,
      },
      {
        id: "L2",
        provider: "sleeper",
        providerLeagueId: "L2",
        name: "Standard League",
        season: 2026,
        week: 1,
        totalTeams: 10,
        scoringType: "standard",
        scoringSettings: { rec_yd: 0.1, rec_td: 6 },
        lastSyncedAt: null,
      },
    ],
    fantasyTeams: [
      { id: "T1", leagueId: "L1", providerRosterId: "1", name: "Me 1", ownerName: "me", isUserTeam: true },
      { id: "T2", leagueId: "L2", providerRosterId: "1", name: "Me 2", ownerName: "me", isUserTeam: true },
    ],
    players: [
      {
        id: "p-wr",
        firstName: "Test",
        lastName: "Receiver",
        fullName: "Test Receiver",
        position: "WR",
        nflTeam: "SEA",
        status: "active",
        providerIds: { sleeper: "1000" },
      },
      {
        id: "p-rb",
        firstName: "Test",
        lastName: "Rusher",
        fullName: "Test Rusher",
        position: "RB",
        nflTeam: "DAL",
        status: "active",
        providerIds: { sleeper: "1001" },
      },
    ],
    rosterSlots: [
      { id: "s1", fantasyTeamId: "T1", leagueId: "L1", playerId: "p-wr", slot: "WR", isStarter: true, week: 1 },
      { id: "s2", fantasyTeamId: "T2", leagueId: "L2", playerId: "p-wr", slot: "WR", isStarter: true, week: 1 },
      { id: "s3", fantasyTeamId: "T1", leagueId: "L1", playerId: "p-rb", slot: "BN", isStarter: false, week: 1 },
    ],
    matchups: [],
    games: [],
    playerStats: [],
    projections: [],
    alerts: [],
    ...overrides,
  };
}

describe("aggregatePortfolio projections", () => {
  it("scores projections under each league's own settings and sums starter-only projected impact", () => {
    const agg = aggregatePortfolio(
      makeSnapshot({
        projections: [
          {
            playerId: "p-wr",
            gameId: "g",
            stats: { rec: 6, rec_yd: 80, rec_td: 1 },
            updatedAt: new Date().toISOString(),
          },
        ],
      })
    );
    const wr = agg.players.find((p) => p.player.id === "p-wr")!;
    const ppr = wr.leagues.find((l) => l.leagueId === "L1")!;
    const std = wr.leagues.find((l) => l.leagueId === "L2")!;
    expect(ppr.projectedPoints).toBe(20); // 6 rec + 8 yd pts + 6 td
    expect(std.projectedPoints).toBe(14); // no reception points
    expect(wr.projectedImpact).toBe(34); // both slots are starters
    // Per-lineup representative: leagues disagree -> PPR-scored projection.
    expect(wr.projectedPerLineup).toBe(20);
    // No projection line for the RB -> null, and impact 0.
    const rb = agg.players.find((p) => p.player.id === "p-rb")!;
    expect(rb.leagues[0].projectedPoints).toBeNull();
    expect(rb.projectedImpact).toBe(0);
  });

  it("excludes bench slots from projected impact", () => {
    const agg = aggregatePortfolio(
      makeSnapshot({
        projections: [
          { playerId: "p-rb", gameId: "g", stats: { rec_yd: 50 }, updatedAt: new Date().toISOString() },
        ],
      })
    );
    const rb = agg.players.find((p) => p.player.id === "p-rb")!;
    expect(rb.leagues[0].projectedPoints).toBe(5);
    expect(rb.projectedImpact).toBe(0); // bench only
  });
});

describe("aggregatePortfolio without a schedule (degraded mode)", () => {
  it("marks players with stats as played and the rest as upcoming — never BYE", () => {
    const agg = aggregatePortfolio(
      makeSnapshot({
        playerStats: [
          {
            playerId: "p-wr",
            gameId: "g",
            stats: { rec: 8, rec_yd: 120 },
            updatedAt: new Date().toISOString(),
          },
        ],
      })
    );
    expect(agg.players.find((p) => p.player.id === "p-wr")!.liveStatus).toBe("played");
    expect(agg.players.find((p) => p.player.id === "p-rb")!.liveStatus).toBe("upcoming");
  });

  it("still reports no_game (bye) when a schedule exists but the player has no game", () => {
    const agg = aggregatePortfolio(
      makeSnapshot({
        games: [
          {
            id: "g1",
            providerGameId: "g1",
            week: 1,
            homeTeam: "KC",
            awayTeam: "BUF",
            homeScore: 0,
            awayScore: 0,
            status: "scheduled",
            quarter: null,
            clock: null,
            possessionTeam: null,
            ballYardLine: null,
            down: null,
            distance: null,
            redZone: false,
            kickoffAt: new Date().toISOString(),
            driveSummary: null,
            updatedAt: new Date().toISOString(),
          },
        ],
      })
    );
    expect(agg.players.find((p) => p.player.id === "p-wr")!.liveStatus).toBe("no_game");
  });
});
