import type {
  NormalizedLeague,
  NormalizedNFLGame,
  NormalizedPlayer,
  NormalizedPlayerGameStats,
  NormalizedRosterSlot,
  PortfolioAlert,
  RawStatLine,
} from "@/lib/types";
import { calculateFantasyPoints, round1 } from "@/lib/scoring/engine";

/**
 * Player-first live activity engine (real / simulated data path).
 *
 * The feed answers: "what did each of MY players just do, and what did it
 * cost or earn me?" Every event is anchored to an owned player and carries
 * the fantasy-point change it caused in each league. Team-level events only
 * appear through a player's lens (e.g. "<your WR> — LAR in the red zone");
 * changes too small to move fantasy points are filtered out.
 *
 * Demo mode ships its own scripted alerts from the simulation instead.
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

/** Human description of a stat delta, e.g. "2 rec · 24 rec yds · rec TD". */
function describeDelta(d: RawStatLine): string {
  const parts: string[] = [];
  const n = (v?: number) => v ?? 0;
  if (n(d.pass_td)) parts.push(`${n(d.pass_td) > 1 ? `${d.pass_td} ` : ""}pass TD`);
  if (n(d.rush_td)) parts.push(`${n(d.rush_td) > 1 ? `${d.rush_td} ` : ""}rush TD`);
  if (n(d.rec_td)) parts.push(`${n(d.rec_td) > 1 ? `${d.rec_td} ` : ""}rec TD`);
  if (n(d.pass_yd)) parts.push(`${d.pass_yd! > 0 ? "+" : ""}${d.pass_yd} pass yds`);
  if (n(d.rush_yd)) parts.push(`${d.rush_yd! > 0 ? "+" : ""}${d.rush_yd} rush yds`);
  if (n(d.rec)) parts.push(`${d.rec! > 0 ? "+" : ""}${d.rec} rec`);
  if (n(d.rec_yd)) parts.push(`${d.rec_yd! > 0 ? "+" : ""}${d.rec_yd} rec yds`);
  if (n(d.pass_int)) parts.push(`${d.pass_int} INT`);
  if (n(d.fum_lost)) parts.push("fumble lost");
  const fgs = n(d.fgm) + n(d.fgm_0_19) + n(d.fgm_20_29) + n(d.fgm_30_39) + n(d.fgm_40_49) + n(d.fgm_50p);
  if (fgs) parts.push(`${fgs > 1 ? `${fgs} ` : ""}FG`);
  if (n(d.xpm)) parts.push(`${n(d.xpm) > 1 ? `${d.xpm} ` : ""}XP`);
  return parts.join(" · ");
}

/**
 * Diff two live states and return fresh player events. Callers keep one
 * event per player (the latest) — see the store in lib/server/portfolio.ts.
 */
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

  const impactsFor = (playerId: string, delta: RawStatLine | null) =>
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

  // --- Owned players' stat changes (the heart of the feed) ---
  for (const entry of next.stats) {
    const slots = slotsByPlayer.get(entry.playerId);
    if (!slots) continue;
    const player = playerById.get(entry.playerId);
    if (!player) continue;
    const before = prevStats.get(entry.playerId) ?? {};
    const s = entry.stats;

    const delta: RawStatLine = {};
    for (const key of new Set([...Object.keys(s), ...Object.keys(before)])) {
      const d = (s[key] ?? 0) - (before[key] ?? 0);
      if (d !== 0) delta[key] = d;
    }
    if (Object.keys(delta).length === 0) continue;

    const impacts = impactsFor(entry.playerId, delta);
    // Any change that moved fantasy points at all qualifies (0.05 guards
    // against floating-point dust only).
    if (!impacts.some((i) => Math.abs(i.points) >= 0.05)) continue;
    const portfolioImpact = round1(
      impacts.filter((i) => i.isStarter).reduce((sum, i) => sum + i.points, 0)
    );

    const tdDelta = (delta.rec_td ?? 0) + (delta.rush_td ?? 0) + (delta.pass_td ?? 0);
    const yardsJump = (delta.rec_yd ?? 0) + (delta.rush_yd ?? 0);
    const crossed = (stat: keyof RawStatLine, threshold: number) =>
      (before[stat] ?? 0) < threshold && (s[stat] ?? 0) >= threshold;
    const milestone = crossed("rec_yd", 100) || crossed("rush_yd", 100) || crossed("pass_yd", 300);

    const type =
      tdDelta > 0 ? "touchdown" : yardsJump >= 20 ? "big_play" : milestone ? "player_milestone" : "stat_update";

    push({
      type,
      headline: `${player.fullName} — ${describeDelta(delta)}`,
      detail: milestone
        ? crossed("pass_yd", 300)
          ? `${s.pass_yd} passing yards`
          : crossed("rush_yd", 100)
            ? `${s.rush_yd} rushing yards`
            : `${s.rec_yd} receiving yards`
        : null,
      playerId: entry.playerId,
      gameId: entry.gameId,
      leagueImpacts: impacts,
      portfolioImpact,
    });
  }

  // --- Red zone, through your player's lens ---
  for (const game of next.games) {
    const before = prevGames.get(game.id);
    if (!before || before.redZone || !game.redZone || !game.possessionTeam) continue;
    // Most-started owned player on the possessing offense fronts the event.
    const owned = ctx.players
      .filter((p) => p.nflTeam === game.possessionTeam && slotsByPlayer.has(p.id))
      .sort(
        (a, b) =>
          (slotsByPlayer.get(b.id)?.filter((sl) => sl.isStarter).length ?? 0) -
          (slotsByPlayer.get(a.id)?.filter((sl) => sl.isStarter).length ?? 0)
      );
    const featured = owned[0];
    if (!featured) continue;
    const defense = game.possessionTeam === game.homeTeam ? game.awayTeam : game.homeTeam;
    push({
      type: "red_zone",
      headline: `${featured.fullName} — ${game.possessionTeam} in the red zone`,
      detail: game.ballYardLine !== null ? `Ball at the ${defense} ${100 - game.ballYardLine}` : null,
      playerId: featured.id,
      gameId: game.id,
      leagueImpacts: impactsFor(featured.id, null),
      portfolioImpact: null,
    });
  }

  return alerts;
}
