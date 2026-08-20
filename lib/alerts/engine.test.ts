import { describe, expect, it } from "vitest";
import { deriveLiveAlerts, type LiveState } from "./engine";
import { SCORING_PRESETS } from "@/lib/scoring/engine";
import type { NormalizedNFLGame, NormalizedPlayer, NormalizedRosterSlot } from "@/lib/types";

const player: NormalizedPlayer = {
  id: "p1", firstName: "", lastName: "", fullName: "Test Receiver", position: "WR",
  nflTeam: "KC", status: "active", providerIds: {},
};
const slots: NormalizedRosterSlot[] = [
  { id: "s1", fantasyTeamId: "t1", leagueId: "L1", playerId: "p1", slot: "WR", isStarter: true, week: 8 },
  { id: "s2", fantasyTeamId: "t2", leagueId: "L2", playerId: "p1", slot: "BN", isStarter: false, week: 8 },
];
const leagues = [
  { id: "L1", provider: "demo", providerLeagueId: "1", name: "A", season: 2025, week: 8, totalTeams: 10, scoringType: "ppr", scoringSettings: SCORING_PRESETS.ppr, lastSyncedAt: null },
  { id: "L2", provider: "demo", providerLeagueId: "2", name: "B", season: 2025, week: 8, totalTeams: 10, scoringType: "standard", scoringSettings: SCORING_PRESETS.standard, lastSyncedAt: null },
] as const;
const game = (rz: boolean): NormalizedNFLGame => ({
  id: "g1", providerGameId: "g1", week: 8, homeTeam: "KC", awayTeam: "DEN", homeScore: 7, awayScore: 3,
  status: "live", quarter: 2, clock: "5:00", possessionTeam: "KC", ballYardLine: rz ? 85 : 40,
  down: 1, distance: 10, redZone: rz, kickoffAt: "", driveSummary: null, updatedAt: "",
});
const ctx = { players: [player], userSlots: slots, leagues: [...leagues] };

describe("player-first live alerts", () => {
  it("emits a player event with per-league point deltas for a TD", () => {
    const prev: LiveState = { games: [game(false)], stats: [{ playerId: "p1", gameId: "g1", stats: { rec: 3, rec_yd: 40 }, updatedAt: "" }] };
    const next: LiveState = { games: [game(false)], stats: [{ playerId: "p1", gameId: "g1", stats: { rec: 4, rec_yd: 52, rec_td: 1 }, updatedAt: "" }] };
    const alerts = deriveLiveAlerts(prev, next, ctx);
    expect(alerts).toHaveLength(1);
    const a = alerts[0];
    expect(a.type).toBe("touchdown");
    expect(a.playerId).toBe("p1");
    expect(a.headline).toContain("Test Receiver");
    // PPR starter: 1 rec + 1.2 yds + 6 = 8.2 ; standard bench: 7.2
    expect(a.leagueImpacts.find((l) => l.leagueId === "L1")?.points).toBeCloseTo(8.2);
    expect(a.leagueImpacts.find((l) => l.leagueId === "L2")?.points).toBeCloseTo(7.2);
    expect(a.portfolioImpact).toBeCloseTo(8.2); // starter leagues only
  });

  it("filters changes that don't move fantasy points", () => {
    const prev: LiveState = { games: [], stats: [{ playerId: "p1", gameId: "g1", stats: { rec_tgt: 4 }, updatedAt: "" }] };
    const next: LiveState = { games: [], stats: [{ playerId: "p1", gameId: "g1", stats: { rec_tgt: 5 }, updatedAt: "" }] };
    expect(deriveLiveAlerts(prev, next, ctx)).toHaveLength(0);
  });

  it("frames red-zone entry through the owned player", () => {
    const prev: LiveState = { games: [game(false)], stats: [] };
    const next: LiveState = { games: [game(true)], stats: [] };
    const alerts = deriveLiveAlerts(prev, next, ctx);
    expect(alerts).toHaveLength(1);
    expect(alerts[0].type).toBe("red_zone");
    expect(alerts[0].headline).toContain("Test Receiver");
    expect(alerts[0].playerId).toBe("p1");
  });
});
