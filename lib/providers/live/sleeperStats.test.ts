import { describe, expect, it } from "vitest";
import {
  canonTeam,
  normalizeScheduleGame,
  normalizeSchedulePayload,
  normalizeWeekStats,
} from "./sleeperStats";

describe("normalizeWeekStats", () => {
  const needed = new Set(["4034", "6794"]);

  it("normalizes the map payload shape, keeping only raw stat keys", () => {
    const payload = {
      "4034": { pass_yd: 285, pass_td: 2, pts_ppr: 24.9, rank_ppr: 3, gp: 1, rush_yd: 12 },
      "6794": { rec: 7, rec_yd: 90, rec_td: 1, pts_half_ppr: 18.5, pos_rank_ppr: 2 },
      "9999": { rec: 5, rec_yd: 60 }, // not rostered — dropped
    };
    const out = normalizeWeekStats(payload, needed);
    expect(out.size).toBe(2);
    expect(out.get("4034")).toEqual({ pass_yd: 285, pass_td: 2, rush_yd: 12 });
    expect(out.get("6794")).toEqual({ rec: 7, rec_yd: 90, rec_td: 1 });
  });

  it("normalizes the array payload shape", () => {
    const payload = [
      { player_id: "4034", stats: { pass_yd: 100, pts_std: 4 } },
      { player_id: "1", stats: { rush_yd: 50 } },
    ];
    const out = normalizeWeekStats(payload, needed);
    expect(out.size).toBe(1);
    expect(out.get("4034")).toEqual({ pass_yd: 100 });
  });

  it("tolerates garbage payloads", () => {
    expect(normalizeWeekStats(null, needed).size).toBe(0);
    expect(normalizeWeekStats("nope", needed).size).toBe(0);
    expect(normalizeWeekStats({ "4034": null }, needed).size).toBe(0);
  });
});

describe("normalizeScheduleGame", () => {
  it("normalizes a schedule entry with status and team aliases", () => {
    const g = normalizeScheduleGame(
      { status: "in_game", date: "2026-09-13", home: "WSH", away: "DAL", week: 1, game_id: "202611013" },
      1
    )!;
    expect(g.homeTeam).toBe("WAS"); // alias resolved to match player data
    expect(g.awayTeam).toBe("DAL");
    expect(g.status).toBe("live");
    expect(g.quarter).toBeNull(); // no clock detail from the schedule
    expect(g.redZone).toBe(false);
  });

  it("maps pre_game/complete statuses and rejects entries without teams", () => {
    expect(normalizeScheduleGame({ status: "pre_game", home: "KC", away: "BUF" }, 1)?.status).toBe(
      "scheduled"
    );
    expect(normalizeScheduleGame({ status: "complete", home: "KC", away: "BUF" }, 1)?.status).toBe(
      "final"
    );
    expect(normalizeScheduleGame({ status: "complete" }, 1)).toBeNull();
  });

  it("canonicalizes team codes", () => {
    expect(canonTeam("wsh")).toBe("WAS");
    expect(canonTeam("KC")).toBe("KC");
    expect(canonTeam(null)).toBeNull();
  });

  it("accepts alternate home/away key spellings", () => {
    const g = normalizeScheduleGame({ home_team: "KC", away_team: "BUF", status: "pre_game" }, 2)!;
    expect(g.homeTeam).toBe("KC");
    expect(g.awayTeam).toBe("BUF");
  });

  it("marks a date-only kickoff as time-unknown instead of inventing a time", () => {
    const g = normalizeScheduleGame(
      { home: "KC", away: "BUF", status: "pre_game", date: "2026-09-13" },
      1
    )!;
    expect(g.kickoffTimeKnown).toBe(false);
    expect(g.kickoffDate).toBe("2026-09-13");
    expect(g.kickoffAt.startsWith("2026-09-13")).toBe(true);
  });

  it("keeps a real kickoff timestamp (epoch millis or ISO) as time-known", () => {
    const epoch = Date.UTC(2026, 8, 13, 17, 0, 0);
    const fromEpoch = normalizeScheduleGame(
      { home: "KC", away: "BUF", status: "pre_game", start_time: epoch },
      1
    )!;
    expect(fromEpoch.kickoffTimeKnown).toBe(true);
    expect(fromEpoch.kickoffAt).toBe(new Date(epoch).toISOString());

    const fromIso = normalizeScheduleGame(
      { home: "KC", away: "BUF", status: "pre_game", date: "2026-09-13T17:00:00Z" },
      1
    )!;
    expect(fromIso.kickoffTimeKnown).toBe(true);
  });
});

describe("normalizeSchedulePayload", () => {
  const kcBuf = { home: "KC", away: "BUF", status: "pre_game", game_id: "g1" };
  const larSea = { home: "SEA", away: "LAR", status: "in_game", game_id: "g2" };

  it("handles a plain array payload", () => {
    const games = normalizeSchedulePayload([kcBuf, larSea], 1);
    expect(games.map((g) => g.homeTeam)).toEqual(["KC", "SEA"]);
  });

  it("handles a { games: [...] } payload", () => {
    expect(normalizeSchedulePayload({ games: [kcBuf] }, 1)).toHaveLength(1);
  });

  it("handles an object keyed by game id", () => {
    expect(normalizeSchedulePayload({ g1: kcBuf, g2: larSea }, 1)).toHaveLength(2);
  });

  it("filters a season-wide payload down to the requested week", () => {
    const seasonWide = [
      { ...kcBuf, week: 1 },
      { ...larSea, week: 2 },
      { home: "DAL", away: "PHI", status: "pre_game", week: "1" }, // string week
    ];
    const games = normalizeSchedulePayload(seasonWide, 1);
    expect(games.map((g) => g.homeTeam)).toEqual(["KC", "DAL"]);
  });

  it("tolerates garbage payloads", () => {
    expect(normalizeSchedulePayload(null, 1)).toEqual([]);
    expect(normalizeSchedulePayload("nope", 1)).toEqual([]);
    expect(normalizeSchedulePayload([{ status: "pre_game" }], 1)).toEqual([]);
  });
});
