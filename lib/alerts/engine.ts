import type {
  NormalizedLeague,
  NormalizedNFLGame,
  NormalizedPlayer,
  NormalizedPlayerGameStats,
  NormalizedRosterSlot,
  PortfolioAlert,
} from "@/lib/types";
import { calculateFantasyPoints, round1 } from "@/lib/scoring/engine";

/**
 * Alert engine for real (non-demo) data: derives portfolio-specific alerts by
 * diffing consecutive live snapshots. Demo mode ships scripted alerts from the
 * simulation instead.
 *
 * The data structures match what a push-notification channel would need
 * later; for now alerts render in the in-app live feed only.
 */

export interface LiveState {
  games: NormalizedNFLGame[];
  stats: NormalizedPlayerGameStats[];
}

export interface AlertContext {
  players: NormalizedPlayer[];
  userSlots: NormalizedRosterSlot[]; // user's roster slots only
  leagues: NormalizedLeague[];
}

let alertSeq = 0;

export function deriveLiveAlerts(
  prev: LiveState,
  next: LiveState,
  ctx: AlertContext
): PortfolioAlert[] {
  const alerts: PortfolioAlert[] = [];
  const now = new Date().toISOString();
  const prevGames = new Map(prev.games.map((g) => [g.id, g]));
  const prevStats = new Map(prev.stats.map((s) => [s.playerId, s.stats]));
  const leagueById = new Map(ctx.leagues.map((l) => [l.id, l]));
  const playerById = new Map(ctx.players.map((p) => [p.id, p]));

  const slotsByPlayer = new Map<string, NormalizedRosterSlot[]>();
  for (const slot of ctx.userSlots) {
    const list = slotsByPlayer.get(slot.playerId) ?? [];
    list.push(slot);
    slotsByPlayer.set(slot.playerId, list);
  }

  const impactsFor = (playerId: string, delta: Record<string, number> | null) =>
    (slotsByPlayer.get(playerId) ?? []).map((slot) => {
      const league = leagueById.get(slot.leagueId);
      return {
        leagueId: slot.leagueId,
        leagueName: league?.name ?? "League",
        isStarter: slot.isStarter,
        points: delta && league ? calculateFantasyPoints(delta, league.scoringSettings) : 0,
      };
    });

  const push = (alert: Omit<PortfolioAlert, "id" | "at">) =>
    alerts.push({ ...alert, id: `live-al-${++alertSeq}`, at: now });

  // --- Game transitions ---
  for (const game of next.games) {
    const before = prevGames.get(game.id);
    if (!before) continue;
    const label = `${game.awayTeam} @ ${game.homeTeam}`;
    if (before.status === "scheduled" && (game.status === "live" || game.status === "halftime")) {
      push({
        type: "game_start",
        headline: `${label} kicked off`,
        detail: null,
        playerId: null,
        gameId: game.id,
        leagueImpacts: [],
        portfolioImpact: null,
      });
    }
    if (before.status !== "final" && game.status === "final") {
      push({
        type: "game_final",
        headline: `${game.awayTeam} ${game.awayScore} — ${game.homeTeam} ${game.homeScore} · Final`,
        detail: null,
        playerId: null,
        gameId: game.id,
        leagueImpacts: [],
        portfolioImpact: null,
      });
    }
    if (!before.redZone && game.redZone && game.possessionTeam) {
      // Only alert when the user owns someone on the possessing offense.
      const owned = ctx.players.filter(
        (p) => p.nflTeam === game.possessionTeam && slotsByPlayer.has(p.id)
      );
      if (owned.length > 0) {
        const featured = owned[0];
        push({
          type: "red_zone",
          headline: `${game.possessionTeam} in the red zone`,
          detail: game.ballYardLine
            ? `Ball at the ${game.possessionTeam === game.homeTeam ? game.awayTeam : game.homeTeam} ${100 - game.ballYardLine}`
            : null,
          playerId: featured.id,
          gameId: game.id,
          leagueImpacts: impactsFor(featured.id, null),
          portfolioImpact: null,
        });
      }
    }
  }

  // --- Player stat transitions (owned players only) ---
  for (const entry of next.stats) {
    if (!slotsByPlayer.has(entry.playerId)) continue;
    const player = playerById.get(entry.playerId);
    if (!player) continue;
    const before = prevStats.get(entry.playerId) ?? {};
    const s = entry.stats;

    const tdNow = (s.rec_td ?? 0) + (s.rush_td ?? 0) + (s.pass_td ?? 0);
    const tdBefore = (before.rec_td ?? 0) + (before.rush_td ?? 0) + (before.pass_td ?? 0);
    const delta: Record<string, number> = {};
    for (const key of Object.keys(s)) {
      const d = (s[key] ?? 0) - (before[key] ?? 0);
      if (d !== 0) delta[key] = d;
    }
    const impacts = impactsFor(entry.playerId, delta);
    const portfolioImpact = round1(
      impacts.filter((i) => i.isStarter).reduce((sum, i) => sum + i.points, 0)
    );

    if (tdNow > tdBefore) {
      const kind = (s.rec_td ?? 0) > (before.rec_td ?? 0) ? "receiving" : (s.rush_td ?? 0) > (before.rush_td ?? 0) ? "rushing" : "passing";
      push({
        type: "touchdown",
        headline: `${player.fullName} — ${kind} TD`,
        detail: null,
        playerId: entry.playerId,
        gameId: entry.gameId,
        leagueImpacts: impacts,
        portfolioImpact,
      });
      continue;
    }

    const yardsJump =
      ((s.rec_yd ?? 0) - (before.rec_yd ?? 0)) +
      ((s.rush_yd ?? 0) - (before.rush_yd ?? 0));
    if (yardsJump >= 25) {
      push({
        type: "big_play",
        headline: `${player.fullName} — ${yardsJump}-yard gain`,
        detail: null,
        playerId: entry.playerId,
        gameId: entry.gameId,
        leagueImpacts: impacts,
        portfolioImpact,
      });
    }

    const crossed = (stat: keyof typeof s, threshold: number) =>
      (before[stat] ?? 0) < threshold && (s[stat] ?? 0) >= threshold;
    if (crossed("rec_yd", 100) || crossed("rush_yd", 100) || crossed("pass_yd", 300)) {
      push({
        type: "player_milestone",
        headline: `${player.fullName} milestone`,
        detail: crossed("pass_yd", 300)
          ? `${s.pass_yd} passing yards`
          : crossed("rush_yd", 100)
            ? `${s.rush_yd} rushing yards`
            : `${s.rec_yd} receiving yards`,
        playerId: entry.playerId,
        gameId: entry.gameId,
        leagueImpacts: impacts,
        portfolioImpact: null,
      });
    }
  }

  return alerts;
}
