import { describe, expect, it } from "vitest";
import type { NormalizedNFLGame, PlayerLeagueContext, PortfolioPlayer, Position, InjuryDesignation, PlayerLiveStatus } from "@/lib/types";
import { injuredStarters, lineupEfficiency, unavailableStarterCount } from "./lineupCheck";

const game: NormalizedNFLGame = {
  id: "g", providerGameId: "g", week: 1, homeTeam: "KC", awayTeam: "BUF", homeScore: 0, awayScore: 0,
  status: "scheduled", quarter: null, clock: null, possessionTeam: null, ballYardLine: null, down: null,
  distance: null, redZone: false, kickoffAt: "2026-09-13T17:00:00Z", driveSummary: null, updatedAt: "",
};

function ctx(leagueId: string, isStarter: boolean, slot: string, projectedPoints: number | null): PlayerLeagueContext {
  return { leagueId, leagueName: leagueId, scoringType: "ppr", isStarter, slot, points: 0, projectedPoints };
}

function player(
  id: string,
  position: Position,
  leagues: PlayerLeagueContext[],
  opts: { injury?: InjuryDesignation | null; game?: NormalizedNFLGame | null; liveStatus?: PlayerLiveStatus } = {}
): PortfolioPlayer {
  const starterCount = leagues.filter((l) => l.isStarter).length;
  return {
    player: {
      id, firstName: id, lastName: "", fullName: id, position, nflTeam: "KC", status: "active",
      injury: opts.injury ?? null, providerIds: {},
    },
    game: opts.game === undefined ? game : opts.game,
    stats: null,
    leagues,
    rosteredCount: leagues.length,
    starterCount,
    totalLeagues: 2,
    rosterExposure: leagues.length / 2,
    starterExposure: starterCount / 2,
    portfolioImpact: 0,
    projectedImpact: 0,
    pointsPerLineup: 0,
    projectedPerLineup: leagues[0]?.projectedPoints ?? null,
    benchPoints: 0,
    maxPoints: 0,
    liveStatus: opts.liveStatus ?? "upcoming",
  };
}

describe("injuredStarters", () => {
  it("lists only starting slots, worst designation first", () => {
    const players = [
      player("q", "WR", [ctx("A", true, "WR", 10)], { injury: "questionable" }),
      player("o", "RB", [ctx("A", true, "RB", 10), ctx("B", false, "BN", 10)], { injury: "out" }),
      player("ir", "TE", [ctx("B", true, "TE", 5)], { injury: "ir" }),
      player("fine", "QB", [ctx("A", true, "QB", 20)]),
    ];
    const rows = injuredStarters(players);
    expect(rows.map((r) => `${r.player.player.id}:${r.leagueId}`)).toEqual(["ir:B", "o:A", "q:A"]);
    expect(unavailableStarterCount(players)).toBe(2); // IR + Out; questionable doesn't count
  });
});

describe("lineupEfficiency", () => {
  it("flags an eligible healthy bench player projecting above the starter", () => {
    const players = [
      player("starterWR", "WR", [ctx("A", true, "WR", 9)]),
      player("benchWR", "WR", [ctx("A", false, "BN", 14.5)]),
    ];
    const flags = lineupEfficiency(players, true);
    expect(flags).toHaveLength(1);
    expect(flags[0]).toMatchObject({ slot: "WR", delta: 5.5, starterProjected: 9, benchProjected: 14.5 });
  });

  it("respects slot eligibility (an RB can't replace a WR, but can fill FLEX)", () => {
    const players = [
      player("starterWR", "WR", [ctx("A", true, "WR", 9)]),
      player("flexTE", "TE", [ctx("A", true, "FLEX", 6)]),
      player("benchRB", "RB", [ctx("A", false, "BN", 12)]),
    ];
    const flags = lineupEfficiency(players, true);
    expect(flags).toHaveLength(1);
    expect(flags[0].slot).toBe("FLEX");
    expect(flags[0].starter.player.id).toBe("flexTE");
  });

  it("ignores injured bench players, players without a game, and locked slots", () => {
    const players = [
      player("starterWR", "WR", [ctx("A", true, "WR", 9)]),
      player("hurt", "WR", [ctx("A", false, "BN", 20)], { injury: "questionable" }),
      player("bye", "WR", [ctx("A", false, "BN", 20)], { game: null, liveStatus: "no_game" }),
      player("lockedStarter", "RB", [ctx("A", true, "RB", 3)], { liveStatus: "live" }),
      player("benchRB", "RB", [ctx("A", false, "BN", 15)]),
    ];
    expect(lineupEfficiency(players, true)).toEqual([]);
  });

  it("proposes each bench player once, for the biggest gain", () => {
    const players = [
      player("wr1", "WR", [ctx("A", true, "WR", 9)]),
      player("wr2", "WR", [ctx("A", true, "WR", 5)]),
      player("benchWR", "WR", [ctx("A", false, "BN", 14)]),
    ];
    const flags = lineupEfficiency(players, true);
    expect(flags).toHaveLength(1);
    expect(flags[0].starter.player.id).toBe("wr2");
    expect(flags[0].delta).toBe(9);
  });

  it("falls back to projection presence when no schedule feed exists", () => {
    const players = [
      player("starterWR", "WR", [ctx("A", true, "WR", 9)], { game: null }),
      player("benchWR", "WR", [ctx("A", false, "BN", 12)], { game: null }),
    ];
    expect(lineupEfficiency(players, false)).toHaveLength(1);
  });
});
