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

describe("matchup projections are expected FINAL scores", () => {
  const baseGame = {
    id: "g1",
    providerGameId: "g1",
    week: 1,
    homeTeam: "SEA",
    awayTeam: "DAL",
    homeScore: 0,
    awayScore: 0,
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
  } as const;

  const withMatchup = (status: "scheduled" | "live" | "final", stats: boolean) =>
    makeSnapshot({
      fantasyTeams: [
        { id: "T1", leagueId: "L1", providerRosterId: "1", name: "Me", ownerName: "me", isUserTeam: true },
        { id: "O1", leagueId: "L1", providerRosterId: "2", name: "Opp", ownerName: "opp", isUserTeam: false },
      ],
      rosterSlots: [
        { id: "s1", fantasyTeamId: "T1", leagueId: "L1", playerId: "p-wr", slot: "WR", isStarter: true, week: 1 },
        { id: "s2", fantasyTeamId: "O1", leagueId: "L1", playerId: "p-rb", slot: "RB", isStarter: true, week: 1 },
      ],
      matchups: [
        {
          id: "m1", leagueId: "L1", week: 1, userTeamId: "T1", opponentTeamId: "O1",
          userScore: 0, opponentScore: 0, userProjected: 0, opponentProjected: 0, winProbability: null, status: "tossup",
        },
      ],
      games: [{ ...baseGame, status }],
      projections: [
        { playerId: "p-wr", gameId: "g1", stats: { rec: 6, rec_yd: 80, rec_td: 1 }, updatedAt: "" }, // 20 in L1
        { playerId: "p-rb", gameId: "g1", stats: { rec_yd: 50 }, updatedAt: "" }, // 5 in L1
      ],
      playerStats: stats
        ? [{ playerId: "p-wr", gameId: "g1", stats: { rec: 10, rec_yd: 150, rec_td: 2 }, updatedAt: "" }] // 37
        : [],
    });

  it("equals the projection before kickoff", () => {
    const m = aggregatePortfolio(withMatchup("scheduled", false)).matchups[0].matchup;
    expect(m.userProjected).toBe(20);
    expect(m.opponentProjected).toBe(5);
    expect(m.winProbability!).toBeGreaterThan(0.5);
  });

  it("adds banked points to the remaining projection while live", () => {
    const m = aggregatePortfolio(withMatchup("live", true)).matchups[0].matchup;
    expect(m.userScore).toBe(37);
    expect(m.userProjected).toBe(47); // 37 banked + half of the 20 projection (no clock -> half over)
    expect(m.userProjected).toBeGreaterThan(m.userScore);
  });

  it("equals the actual score once final", () => {
    const m = aggregatePortfolio(withMatchup("final", true)).matchups[0].matchup;
    expect(m.userProjected).toBe(37);
    expect(m.status).toBe("final");
    expect(m.winProbability).toBe(1);
  });
});

describe("starters who will not play", () => {
  it("project to zero even when the feed still carries a projection", () => {
    const snap = makeSnapshot({
      projections: [
        { playerId: "p-wr", gameId: "g", stats: { rec: 6, rec_yd: 80, rec_td: 1 }, updatedAt: "" },
      ],
    });
    snap.players[0].injury = "out";
    const wr = aggregatePortfolio(snap).players.find((p) => p.player.id === "p-wr")!;
    expect(wr.leagues.every((l) => l.projectedPoints === 0)).toBe(true);
    expect(wr.projectedImpact).toBe(0);
  });
});
