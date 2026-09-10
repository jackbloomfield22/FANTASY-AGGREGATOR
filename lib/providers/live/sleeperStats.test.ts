import { describe, expect, it } from "vitest";
import { canonTeam, normalizeScheduleGame, normalizeWeekStats } from "./sleeperStats";

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
});
