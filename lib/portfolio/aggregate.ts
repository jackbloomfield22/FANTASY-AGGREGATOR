import type {
  MatchupView,
  NormalizedFantasyTeam,
  NormalizedNFLGame,
  NormalizedPlayer,
  PlayerLeagueContext,
  PlayerLiveStatus,
  PortfolioPlayer,
  PortfolioSnapshot,
  RankedGame,
  RawStatLine,
} from "@/lib/types";
import { calculateFantasyPoints, round1, SCORING_PRESETS } from "@/lib/scoring/engine";
import { benchPoints, portfolioImpact, rosterExposure, starterExposure } from "./exposure";
import { exposureLevel, gameImportanceScore } from "./importance";
import { estimateWinProbability } from "./winProbability";

/**
 * The join layer: fantasy ownership + live NFL performance = portfolio.
 *
 * Everything here is pure derivation from a PortfolioSnapshot, so the UI can
 * memoize one call per snapshot and never issue per-player requests.
 */

export interface PortfolioSummary {
  leagues: number;
  uniquePlayers: number;
  startingSomewhere: number;
  liveNow: number;
  inRedZone: number;
  playingLater: number;
  finished: number;
  gamesLive: number;
  projectedWins: number;
  projectedLosses: number;
  tossups: number;
  totalStartingPoints: number;
}

export interface AggregatedPortfolio {
  players: PortfolioPlayer[];
  games: RankedGame[];
  matchups: MatchupView[];
  summary: PortfolioSummary;
  mostImportantGame: RankedGame | null;
  biggestSwing: PortfolioPlayer | null;
}

export function aggregatePortfolio(snapshot: PortfolioSnapshot): AggregatedPortfolio {
  const leagueById = new Map(snapshot.leagues.map((l) => [l.id, l]));
  const teamById = new Map(snapshot.fantasyTeams.map((t) => [t.id, t]));
  const playerById = new Map(snapshot.players.map((p) => [p.id, p]));
  const statsByPlayer = new Map(snapshot.playerStats.map((s) => [s.playerId, s]));
  const projByPlayer = new Map((snapshot.projections ?? []).map((s) => [s.playerId, s]));
  const gameByNflTeam = new Map<string, NormalizedNFLGame>();
  for (const g of snapshot.games) {
    gameByNflTeam.set(g.homeTeam, g);
    gameByNflTeam.set(g.awayTeam, g);
  }

  const userTeamIds = new Set(
    snapshot.fantasyTeams.filter((t) => t.isUserTeam).map((t) => t.id)
  );
  const totalLeagues = snapshot.leagues.length;
  const hasStats = snapshot.playerStats.length > 0;

  // -------------------------------------------------------------------------
  // Players: fold the user's roster slots into one entry per canonical player
  // -------------------------------------------------------------------------
  const contextsByPlayer = new Map<string, PlayerLeagueContext[]>();
  for (const slot of snapshot.rosterSlots) {
    if (!userTeamIds.has(slot.fantasyTeamId)) continue;
    const league = leagueById.get(slot.leagueId);
    if (!league) continue;
    const player = playerById.get(slot.playerId);
    if (!player) continue;
    const stats = statsByPlayer.get(slot.playerId)?.stats ?? null;
    // A starter who won't play projects to zero, whatever the feed says.
    const projLine = willNotPlay(player) ? null : projByPlayer.get(slot.playerId)?.stats ?? null;
    const ctx: PlayerLeagueContext = {
      leagueId: league.id,
      leagueName: league.name,
      scoringType: league.scoringType,
      isStarter: slot.isStarter,
      slot: slot.slot,
      points: stats
        ? calculateFantasyPoints(stats, league.scoringSettings)
        : slot.providerPoints ?? 0,
      projectedPoints: willNotPlay(player)
        ? 0
        : projLine
          ? round1(calculateFantasyPoints(projLine, league.scoringSettings))
          : null,
      gameFinal: gameByNflTeam.get(player.nflTeam)?.status === "final",
    };
    const list = contextsByPlayer.get(slot.playerId);
    if (list) list.push(ctx);
    else contextsByPlayer.set(slot.playerId, [ctx]);
  }

  // One lineup's worth of points: leagues usually agree; when their rules
  // differ, the PPR-scored line is the representative number (owner call —
  // a per-lineup figure always beats an unhelpful cross-league total).
  const perLineup = (values: number[], raw: RawStatLine | null): number => {
    if (values.length === 0) return 0;
    const distinct = new Set(values.map((v) => round1(v)));
    if (distinct.size === 1) return round1(values[0]);
    if (!raw) return round1(Math.max(...values));
    return round1(calculateFantasyPoints(raw, SCORING_PRESETS.ppr));
  };

  const players: PortfolioPlayer[] = [];
  for (const [playerId, contexts] of contextsByPlayer) {
    const player = playerById.get(playerId)!;
    const game = gameByNflTeam.get(player.nflTeam) ?? null;
    const stats = statsByPlayer.get(playerId)?.stats ?? null;
    const projLineRaw = projByPlayer.get(playerId)?.stats ?? null;
    const projVals = contexts
      .map((c) => c.projectedPoints)
      .filter((v): v is number => v !== null);
    const starterCount = contexts.filter((c) => c.isStarter).length;
    players.push({
      player,
      game,
      stats,
      leagues: [...contexts].sort((a, b) =>
        a.isStarter === b.isStarter ? a.leagueName.localeCompare(b.leagueName) : a.isStarter ? -1 : 1
      ),
      rosteredCount: contexts.length,
      starterCount,
      totalLeagues,
      rosterExposure: rosterExposure(contexts.length, totalLeagues),
      starterExposure: starterExposure(starterCount, totalLeagues),
      portfolioImpact: portfolioImpact(contexts),
      projectedImpact: round1(
        contexts.reduce((s, c) => s + (c.isStarter ? c.projectedPoints ?? 0 : 0), 0)
      ),
      pointsPerLineup: perLineup(contexts.map((c) => c.points), stats),
      projectedPerLineup: projVals.length > 0 ? perLineup(projVals, projLineRaw) : null,
      benchPoints: benchPoints(contexts),
      maxPoints: contexts.reduce((m, c) => Math.max(m, c.points), 0),
      liveStatus: playerLiveStatus(game, player, {
        hasSchedule: snapshot.games.length > 0,
        hasStats: stats !== null,
      }),
    });
  }
  players.sort((a, b) => b.portfolioImpact - a.portfolioImpact);

  // -------------------------------------------------------------------------
  // Games ranked by fantasy relevance
  // -------------------------------------------------------------------------
  const games: RankedGame[] = snapshot.games.map((game) => {
    const involved = players.filter((p) => p.game?.id === game.id);
    const starterCount = involved.filter((p) => p.starterCount > 0).length;
    const benchCount = involved.length - starterCount;
    return {
      game,
      players: involved,
      starterCount,
      benchCount,
      importanceScore: gameImportanceScore({
        starterCount,
        benchCount,
        isLive: game.status === "live" || game.status === "halftime",
        isRedZone: game.redZone,
      }),
      exposureLevel: exposureLevel(starterCount, benchCount),
    };
  });
  games.sort((a, b) => b.importanceScore - a.importanceScore);

  // -------------------------------------------------------------------------
  // Matchups
  // -------------------------------------------------------------------------
  const matchups: MatchupView[] = [];
  for (const raw of snapshot.matchups) {
    const league = leagueById.get(raw.leagueId);
    const userTeam = teamById.get(raw.userTeamId);
    const opponentTeam = teamById.get(raw.opponentTeamId);
    if (!league || !userTeam || !opponentTeam) continue;

    const scoreFor = (
      teamId: string
    ): { score: number; remaining: number; remainingWeight: number; allFinal: boolean; expected: number | null } => {
      const slots = snapshot.rosterSlots.filter(
        (s) => s.fantasyTeamId === teamId && s.isStarter
      );
      let score = 0;
      let remaining = 0;
      let remainingWeight = 0;
      let expected = 0;
      let projected = 0;
      let allFinal = slots.length > 0;
      for (const slot of slots) {
        const player = playerById.get(slot.playerId);
        const stats = player ? statsByPlayer.get(player.id)?.stats ?? null : null;
        const actual = stats
          ? calculateFantasyPoints(stats, league.scoringSettings)
          : slot.providerPoints ?? 0;
        score += actual;
        // Bye week / free agent (no game this week): nothing left to play, so
        // don't count toward "remaining" or block the matchup going final.
        const game = player ? gameByNflTeam.get(player.nflTeam) : undefined;
        if (!player || (snapshot.games.length > 0 && !game)) {
          expected += actual;
          continue;
        }
        const left = gameRemainingFraction(game ?? null, stats !== null);
        if (left > 0) {
          allFinal = false;
          remaining += 1;
          remainingWeight += left;
        }
        // Expected final: what's banked plus the unplayed share of his projection.
        const projLine = projByPlayer.get(player.id)?.stats ?? null;
        if (projLine && !willNotPlay(player)) {
          projected += 1;
          expected += actual + calculateFantasyPoints(projLine, league.scoringSettings) * left;
        } else {
          if (projLine) projected += 1; // known: he's out, so his projection is a real 0
          expected += actual;
        }
      }
      return {
        score: round1(score),
        remaining,
        remainingWeight,
        allFinal,
        expected: projected > 0 ? round1(expected) : null,
      };
    };

    const user = scoreFor(raw.userTeamId);
    const opp = scoreFor(raw.opponentTeamId);
    // When live stats exist, trust the locally-computed league-scored totals;
    // otherwise fall back to provider-reported matchup scores.
    const userScore = hasStats ? user.score : raw.userScore;
    const opponentScore = hasStats ? opp.score : raw.opponentScore;
    const complete = raw.status === "final" || (hasStats && user.allFinal && opp.allFinal);
    // Projected = expected FINAL score (banked points + remaining projection),
    // falling back to the provider's number when no projections exist.
    const userProjected = complete ? userScore : (user.expected ?? raw.userProjected);
    const opponentProjected = complete ? opponentScore : (opp.expected ?? raw.opponentProjected);

    const winProbability =
      raw.winProbability ??
      estimateWinProbability({
        userScore,
        opponentScore,
        userProjected,
        opponentProjected,
        userPlayersRemaining: user.remainingWeight,
        opponentPlayersRemaining: opp.remainingWeight,
        matchupComplete: complete,
      });

    const status = complete
      ? "final"
      : winProbability >= 0.55
        ? "winning"
        : winProbability <= 0.45
          ? "losing"
          : "tossup";

    matchups.push({
      matchup: { ...raw, userScore, opponentScore, userProjected, opponentProjected, winProbability, status },
      league,
      userTeam,
      opponentTeam,
      userRemaining: user.remaining,
      opponentRemaining: opp.remaining,
    });
  }
  matchups.sort((a, b) => a.league.name.localeCompare(b.league.name));

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  const summary: PortfolioSummary = {
    leagues: totalLeagues,
    uniquePlayers: players.length,
    startingSomewhere: players.filter((p) => p.starterCount > 0).length,
    liveNow: players.filter((p) => p.liveStatus === "live" || p.liveStatus === "red_zone").length,
    inRedZone: players.filter((p) => p.liveStatus === "red_zone").length,
    playingLater: players.filter((p) => p.liveStatus === "upcoming").length,
    finished: players.filter((p) => p.liveStatus === "final" || p.liveStatus === "played").length,
    gamesLive: snapshot.games.filter((g) => g.status === "live" || g.status === "halftime").length,
    projectedWins: matchups.filter(
      (m) => m.matchup.status === "winning" || (m.matchup.status === "final" && m.matchup.userScore > m.matchup.opponentScore)
    ).length,
    projectedLosses: matchups.filter(
      (m) => m.matchup.status === "losing" || (m.matchup.status === "final" && m.matchup.userScore < m.matchup.opponentScore)
    ).length,
    tossups: matchups.filter((m) => m.matchup.status === "tossup").length,
    totalStartingPoints: round1(players.reduce((s, p) => s + p.portfolioImpact, 0)),
  };

  const gamesWithExposure = games.filter((g) => g.players.length > 0);
  const mostImportantGame = gamesWithExposure[0] ?? null;

  const biggestSwing =
    [...players].sort((a, b) => {
      const aLive = a.liveStatus === "live" || a.liveStatus === "red_zone" ? 1 : 0;
      const bLive = b.liveStatus === "live" || b.liveStatus === "red_zone" ? 1 : 0;
      if (aLive !== bLive) return bLive - aLive;
      return b.portfolioImpact - a.portfolioImpact;
    })[0] ?? null;

  return { players, games, matchups, summary, mostImportantGame, biggestSwing };
}

/** Out / IR / suspended: no projection should count for him this week. */
export function willNotPlay(player: NormalizedPlayer): boolean {
  return player.injury === "out" || player.injury === "ir" || player.injury === "suspended";
}

/**
 * How much of a player's game is still to be played, 0..1. Uses the quarter
 * and clock when the feed supplies them; a live game without a clock counts
 * as half over. With no schedule at all, stats presence is the only signal.
 */
export function gameRemainingFraction(game: NormalizedNFLGame | null, hasStats: boolean): number {
  if (!game) return hasStats ? 0.5 : 1;
  switch (game.status) {
    case "scheduled":
      return 1;
    case "final":
      return 0;
    case "halftime":
      return 0.5;
    case "live": {
      if (game.quarter === null) return 0.5;
      const [m, sec] = (game.clock ?? "").split(":").map(Number);
      const minutesLeftInQuarter = Number.isFinite(m) ? m + (Number.isFinite(sec) ? sec / 60 : 0) : 7.5;
      const quartersLeft = Math.max(0, 4 - Math.min(game.quarter, 4));
      const left = (quartersLeft * 15 + Math.min(15, minutesLeftInQuarter)) / 60;
      return Math.min(0.95, Math.max(0.05, left));
    }
  }
}

export function playerLiveStatus(
  game: NormalizedNFLGame | null,
  player: NormalizedPlayer,
  /** When the schedule feed is down entirely, stats presence still tells an
   *  honest story: points on the board = has played (or is playing), nothing
   *  yet = still waiting. Only used when `game` is null. */
  fallback?: { hasSchedule: boolean; hasStats: boolean }
): PlayerLiveStatus {
  if (!game) {
    if (fallback && !fallback.hasSchedule) return fallback.hasStats ? "played" : "upcoming";
    return "no_game";
  }
  switch (game.status) {
    case "scheduled":
      return "upcoming";
    case "final":
      return "final";
    case "halftime":
      return "halftime";
    case "live":
      return game.redZone && game.possessionTeam === player.nflTeam ? "red_zone" : "live";
  }
}

/** Find the user's team in a league (helper shared by pages). */
export function userTeamForLeague(
  teams: NormalizedFantasyTeam[],
  leagueId: string
): NormalizedFantasyTeam | undefined {
  return teams.find((t) => t.leagueId === leagueId && t.isUserTeam);
}
