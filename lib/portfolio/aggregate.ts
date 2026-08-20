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
} from "@/lib/types";
import { calculateFantasyPoints, round1 } from "@/lib/scoring/engine";
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
    const ctx: PlayerLeagueContext = {
      leagueId: league.id,
      leagueName: league.name,
      scoringType: league.scoringType,
      isStarter: slot.isStarter,
      slot: slot.slot,
      points: stats
        ? calculateFantasyPoints(stats, league.scoringSettings)
        : slot.providerPoints ?? 0,
    };
    const list = contextsByPlayer.get(slot.playerId);
    if (list) list.push(ctx);
    else contextsByPlayer.set(slot.playerId, [ctx]);
  }

  const players: PortfolioPlayer[] = [];
  for (const [playerId, contexts] of contextsByPlayer) {
    const player = playerById.get(playerId)!;
    const game = gameByNflTeam.get(player.nflTeam) ?? null;
    const stats = statsByPlayer.get(playerId)?.stats ?? null;
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
      benchPoints: benchPoints(contexts),
      maxPoints: contexts.reduce((m, c) => Math.max(m, c.points), 0),
      liveStatus: playerLiveStatus(game, player),
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

    const scoreFor = (teamId: string): { score: number; remaining: number; allFinal: boolean } => {
      const slots = snapshot.rosterSlots.filter(
        (s) => s.fantasyTeamId === teamId && s.isStarter
      );
      let score = 0;
      let remaining = 0;
      let allFinal = slots.length > 0;
      for (const slot of slots) {
        const player = playerById.get(slot.playerId);
        const stats = player ? statsByPlayer.get(player.id)?.stats ?? null : null;
        score += stats
          ? calculateFantasyPoints(stats, league.scoringSettings)
          : slot.providerPoints ?? 0;
        // Bye week / free agent (no game this week): nothing left to play, so
        // don't count toward "remaining" or block the matchup going final.
        const game = player ? gameByNflTeam.get(player.nflTeam) : undefined;
        if (!player || (snapshot.games.length > 0 && !game)) continue;
        if (!game || game.status !== "final") {
          allFinal = false;
          remaining += 1;
        }
      }
      return { score: round1(score), remaining, allFinal };
    };

    const user = scoreFor(raw.userTeamId);
    const opp = scoreFor(raw.opponentTeamId);
    // When live stats exist, trust the locally-computed league-scored totals;
    // otherwise fall back to provider-reported matchup scores.
    const userScore = hasStats ? user.score : raw.userScore;
    const opponentScore = hasStats ? opp.score : raw.opponentScore;
    const complete = raw.status === "final" || (hasStats && user.allFinal && opp.allFinal);

    const winProbability =
      raw.winProbability ??
      estimateWinProbability({
        userScore,
        opponentScore,
        userProjected: raw.userProjected,
        opponentProjected: raw.opponentProjected,
        userPlayersRemaining: user.remaining,
        opponentPlayersRemaining: opp.remaining,
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
      matchup: { ...raw, userScore, opponentScore, winProbability, status },
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
    finished: players.filter((p) => p.liveStatus === "final").length,
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

export function playerLiveStatus(
  game: NormalizedNFLGame | null,
  player: NormalizedPlayer
): PlayerLiveStatus {
  if (!game) return "no_game";
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
