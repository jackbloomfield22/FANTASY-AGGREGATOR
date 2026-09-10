import { expect, it } from "vitest";
import { buildSimulatedLiveLayer } from "./liveSim";
import type { NormalizedPlayer } from "@/lib/types";

const mk = (id: string, pos: NormalizedPlayer["position"], team: string): NormalizedPlayer => ({
  id, firstName: "", lastName: "", fullName: id, position: pos, nflTeam: team,
  status: "active", providerIds: {},
});
const players = [
  mk("a", "QB", "KC"), mk("b", "RB", "SF"), mk("c", "WR", "DAL"), mk("d", "WR", "BUF"),
  mk("e", "TE", "PHI"), mk("f", "RB", "DET"), mk("g", "WR", "MIA"), mk("h", "QB", "FA"),
];
const ENABLED = Date.UTC(2026, 8, 6, 17, 0, 0);
const totalYds = (x: ReturnType<typeof buildSimulatedLiveLayer>, id: string) =>
  Object.values(x.playerStats.find((s) => s.playerId === id)?.stats ?? {}).reduce(
    (s, v) => s! + v!,
    0
  )!;

it("simulated layer: deterministic, live games, moving stats", () => {
  const t = ENABLED + 10 * 60_000; // 10 minutes in
  const a = buildSimulatedLiveLayer(players, 8, t, ENABLED);
  const b = buildSimulatedLiveLayer(players, 8, t, ENABLED);
  expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  expect(a.games.length).toBeGreaterThanOrEqual(3);
  expect(a.games.some((g) => g.status === "live")).toBe(true);
  expect(a.playerStats.length).toBeGreaterThan(0);
  expect(a.playerStats.every((s) => s.playerId !== "h")).toBe(true); // FA has no game

  const later = buildSimulatedLiveLayer(players, 8, t + 15 * 60_000, ENABLED);
  const grew = players.some((p) => totalYds(later, p.id) > totalYds(a, p.id));
  expect(grew).toBe(true);
});

it("simulated Sunday is monotonic: never rewinds, plays out to all finals", () => {
  // Stats must never shrink between polls at any horizon (no cycle wrap).
  let prev = buildSimulatedLiveLayer(players, 8, ENABLED, ENABLED);
  for (const min of [20, 45, 60, 90, 120, 180]) {
    const next = buildSimulatedLiveLayer(players, 8, ENABLED + min * 60_000, ENABLED);
    for (const p of players) {
      expect(totalYds(next, p.id)).toBeGreaterThanOrEqual(totalYds(prev, p.id));
    }
    prev = next;
  }
  // Three hours in, the whole slate is final and frozen.
  expect(prev.games.every((g) => g.status === "final")).toBe(true);
});

it("late games are scheduled first, then kick off mid-simulation", () => {
  const early = buildSimulatedLiveLayer(players, 8, ENABLED + 5 * 60_000, ENABLED);
  const later = buildSimulatedLiveLayer(players, 8, ENABLED + 60 * 60_000, ENABLED);
  const scheduledEarly = early.games.filter((g) => g.status === "scheduled").length;
  const scheduledLater = later.games.filter((g) => g.status === "scheduled").length;
  expect(scheduledLater).toBeLessThanOrEqual(scheduledEarly);
});
