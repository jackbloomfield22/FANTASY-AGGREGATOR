import { expect, it } from "vitest";
import { buildSimulatedLiveLayer } from "./liveSim";
import type { NormalizedPlayer } from "@/lib/types";

const mk = (id: string, pos: NormalizedPlayer["position"], team: string): NormalizedPlayer => ({
  id, firstName: "", lastName: "", fullName: id, position: pos, nflTeam: team,
  status: "active", providerIds: {},
});
const players = [
  mk("a","QB","KC"), mk("b","RB","SF"), mk("c","WR","DAL"), mk("d","WR","BUF"),
  mk("e","TE","PHI"), mk("f","RB","DET"), mk("g","WR","MIA"), mk("h","QB","FA"),
];
it("simulated layer: deterministic, live games, moving stats", () => {
  const t0 = Date.UTC(2026, 0, 4, 18, 10, 0);
  const a = buildSimulatedLiveLayer(players, 8, t0);
  const b = buildSimulatedLiveLayer(players, 8, t0);
  expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  expect(a.games.length).toBeGreaterThanOrEqual(3);
  expect(a.games.some((g) => g.status === "live")).toBe(true);
  expect(a.playerStats.length).toBeGreaterThan(0);
  expect(a.playerStats.every((s) => s.playerId !== "h")).toBe(true); // FA has no game
  const later = buildSimulatedLiveLayer(players, 8, t0 + 900_000);
  const yds = (x: typeof a, id: string) =>
    Object.values(x.playerStats.find((s) => s.playerId === id)?.stats ?? {}).reduce((s, v) => s! + v!, 0)!;
  const grew = players.some((p) => yds(later, p.id) > yds(a, p.id));
  expect(grew).toBe(true);
});
