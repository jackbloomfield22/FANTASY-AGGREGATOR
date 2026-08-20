import type {
  NormalizedNFLGame,
  NormalizedPlayer,
  NormalizedPlayerGameStats,
} from "@/lib/types";
import { generatedFullLine, hashString, mulberry32 } from "./data";
import { scaleLine } from "./simulation";

/**
 * Simulated live Sunday for REAL fantasy rosters.
 *
 * When a user connects Sleeper but has no live-data provider configured,
 * this layer fabricates a believable mid-Sunday (~1:45pm ET, early games in
 * the 2nd quarter, late games upcoming) for the NFL teams their rostered
 * players are on. Deterministic: state is a pure function of wall-clock
 * time on a repeating cycle, so polling shows smooth progression. Always
 * surfaced in the UI as simulated — never passed off as real stats.
 */

const CYCLE_S = 2700; // 45-minute loop
const EPOCH_MS = Date.UTC(2026, 0, 4, 18, 0, 0);

/** Filler opponents for an odd team out (skipped if already rostered). */
const FILLER_TEAMS = ["ATL", "CAR", "JAX", "TEN", "NO", "LV", "HOU", "IND", "WAS", "NYG"];

function fmtClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function buildSimulatedLiveLayer(
  players: NormalizedPlayer[],
  week: number,
  nowMs: number
): { games: NormalizedNFLGame[]; playerStats: NormalizedPlayerGameStats[] } {
  const elapsed = (((nowMs - EPOCH_MS) % (CYCLE_S * 1000)) + CYCLE_S * 1000) % (CYCLE_S * 1000) / 1000;
  const cycleFrac = elapsed / CYCLE_S;
  const nowIso = new Date(nowMs).toISOString();

  const teams = [...new Set(players.map((p) => p.nflTeam).filter((t) => t && t !== "FA"))].sort();
  const teamSet = new Set(teams);
  if (teams.length % 2 === 1) {
    const filler = FILLER_TEAMS.find((t) => !teamSet.has(t)) ?? "ATL";
    teams.push(filler);
  }

  const games: NormalizedNFLGame[] = [];
  const gameByTeam = new Map<string, { game: NormalizedNFLGame; progress: number }>();

  for (let i = 0; i < teams.length; i += 2) {
    const away = teams[i];
    const home = teams[i + 1];
    const seed = hashString(`sim-${away}-${home}`);
    const rand = mulberry32(seed);
    // ~70% of games are in the early window (live now), the rest kick later.
    const isEarly = rand() < 0.7;
    const isLateAfternoon = rand() < 0.7; // vs night game

    if (!isEarly) {
      games.push({
        id: `sim-${away}-${home}`,
        providerGameId: `sim-${away}-${home}`,
        week,
        homeTeam: home,
        awayTeam: away,
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
        kickoffAt: new Date(nowMs + (isLateAfternoon ? 2.5 : 6.5) * 3600_000).toISOString(),
        driveSummary: null,
        updatedAt: nowIso,
      });
      continue;
    }

    // Live early game: ~1:45pm ET means roughly the 2nd quarter at cycle
    // start, drifting into the 4th by the end of the loop.
    const progress = 0.28 + 0.55 * cycleFrac + rand() * 0.06;
    const qFloat = Math.min(3.99, progress * 4.3);
    const quarter = 1 + Math.floor(qFloat);
    const clock = fmtClock(900 * (1 - (qFloat % 1)));

    const homeFinal = 17 + Math.floor(rand() * 18);
    const awayFinal = 17 + Math.floor(rand() * 18);
    const homeScore = Math.min(homeFinal, Math.floor(homeFinal * progress * 1.1));
    const awayScore = Math.min(awayFinal, Math.floor(awayFinal * progress * 1.1));

    // Possession/field position drift deterministically with the clock; the
    // ball crossing the 80 marker creates natural red-zone windows.
    const driveTick = Math.floor(elapsed / 30) + (seed % 7);
    const possessionTeam = driveTick % 2 === 0 ? home : away;
    const ballYardLine = 15 + ((driveTick * 23 + (seed % 13)) % 86);
    const redZone = ballYardLine >= 80;

    const game: NormalizedNFLGame = {
      id: `sim-${away}-${home}`,
      providerGameId: `sim-${away}-${home}`,
      week,
      homeTeam: home,
      awayTeam: away,
      homeScore,
      awayScore,
      status: "live",
      quarter,
      clock,
      possessionTeam,
      ballYardLine,
      down: 1 + (driveTick % 3),
      distance: [10, 7, 4][driveTick % 3],
      redZone,
      kickoffAt: new Date(nowMs - 45 * 60_000).toISOString(),
      driveSummary: null,
      updatedAt: nowIso,
    };
    games.push(game);
    gameByTeam.set(home, { game, progress });
    gameByTeam.set(away, { game, progress });
  }

  // Stats: a plausible seeded full-game line per player, scaled by how much
  // of his game has been played.
  const playerStats: NormalizedPlayerGameStats[] = [];
  for (const player of players) {
    const entry = gameByTeam.get(player.nflTeam);
    if (!entry) continue;
    const full = generatedFullLine(`sim-${player.id}-w${week}`, player.position);
    const stats = scaleLine(full, entry.progress);
    if (Object.keys(stats).length === 0) continue;
    playerStats.push({ playerId: player.id, gameId: entry.game.id, stats, updatedAt: nowIso });
  }

  return { games, playerStats };
}
