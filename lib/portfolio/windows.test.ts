import { describe, expect, it } from "vitest";
import type { NormalizedNFLGame, RankedGame } from "@/lib/types";
import { buildWindows, defaultWindowId, windowForGame } from "./windows";

function game(over: Partial<NormalizedNFLGame>): NormalizedNFLGame {
  return {
    id: over.id ?? "g",
    providerGameId: "g",
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
    kickoffAt: "2026-09-13T17:00:00Z",
    driveSummary: null,
    updatedAt: "",
    ...over,
  };
}
const ranked = (g: NormalizedNFLGame, importance = 0): RankedGame => ({
  game: g,
  players: [],
  starterCount: 0,
  benchCount: 0,
  importanceScore: importance,
  exposureLevel: "none",
});

describe("windowForGame (Eastern Time slates)", () => {
  it("assigns the classic windows from real kickoff timestamps", () => {
    // Thu 8:15pm ET (Sep = EDT, UTC-4) -> 00:15Z Friday
    expect(windowForGame(game({ kickoffAt: "2026-09-11T00:15:00Z" }))).toBe("thu");
    expect(windowForGame(game({ kickoffAt: "2026-09-13T17:00:00Z" }))).toBe("sun_early"); // 1:00pm
    expect(windowForGame(game({ kickoffAt: "2026-09-13T20:05:00Z" }))).toBe("sun_late"); // 4:05pm
    expect(windowForGame(game({ kickoffAt: "2026-09-13T20:25:00Z" }))).toBe("sun_late"); // 4:25pm
    expect(windowForGame(game({ kickoffAt: "2026-09-14T00:20:00Z" }))).toBe("sun_night"); // 8:20pm
    expect(windowForGame(game({ kickoffAt: "2026-09-15T00:15:00Z" }))).toBe("mon"); // Mon 8:15pm
    expect(windowForGame(game({ kickoffAt: "2026-12-19T21:30:00Z" }))).toBe("sat");
  });

  it("uses one honest Sunday window when only the date is known", () => {
    expect(
      windowForGame(game({ kickoffTimeKnown: false, kickoffDate: "2026-09-13" }))
    ).toBe("sun");
    expect(
      windowForGame(game({ kickoffTimeKnown: false, kickoffDate: "2026-09-10" }))
    ).toBe("thu");
    expect(
      windowForGame(game({ kickoffTimeKnown: false, kickoffDate: "2026-09-14" }))
    ).toBe("mon");
  });
});

describe("buildWindows / defaultWindowId", () => {
  const thu = ranked(game({ id: "thu", kickoffAt: "2026-09-11T00:15:00Z", status: "final" }));
  const early = ranked(game({ id: "e1", kickoffAt: "2026-09-13T17:00:00Z", status: "live" }), 5);
  const early2 = ranked(game({ id: "e2", kickoffAt: "2026-09-13T17:00:00Z", status: "live" }), 9);
  const late = ranked(game({ id: "l1", kickoffAt: "2026-09-13T20:25:00Z" }));
  const mon = ranked(game({ id: "m1", kickoffAt: "2026-09-15T00:15:00Z" }));

  it("orders windows chronologically and games by exposure within a slate", () => {
    const windows = buildWindows([mon, late, early, thu, early2]);
    expect(windows.map((w) => w.id)).toEqual(["thu", "sun_early", "sun_late", "mon"]);
    expect(windows[1].games.map((g) => g.game.id)).toEqual(["e2", "e1"]);
    expect(windows.map((w) => w.state)).toEqual(["final", "live", "upcoming", "upcoming"]);
  });

  it("defaults to the live window, else the next one up, else the last", () => {
    expect(defaultWindowId(buildWindows([thu, early, late, mon]))).toBe("sun_early");
    expect(defaultWindowId(buildWindows([thu, late, mon]))).toBe("sun_late");
    const allFinal = buildWindows([thu, ranked(game({ id: "x", kickoffAt: "2026-09-15T00:15:00Z", status: "final" }))]);
    expect(defaultWindowId(allFinal)).toBe("mon");
    expect(defaultWindowId([])).toBeNull();
  });
});
