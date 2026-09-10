import "server-only";
import type {
  FantasyConnectionInfo,
  NormalizedNFLGame,
  NormalizedPlayer,
  NormalizedPlayerGameStats,
  PortfolioAlert,
  PortfolioSnapshot,
} from "@/lib/types";
import type { RawStatLine } from "@/lib/types";
import { buildDemoSnapshot } from "@/lib/demo/simulation";
import { sleeperProvider } from "@/lib/providers/fantasy/sleeper";
import { yahooProvider } from "@/lib/providers/fantasy/yahoo";
import { sportradarProvider } from "@/lib/providers/live/sportradar";
import { sleeperLiveProvider } from "@/lib/providers/live/sleeperStats";
import { deriveLiveAlerts, LiveState } from "@/lib/alerts/engine";
import { calculateFantasyPoints, round1 } from "@/lib/scoring/engine";
import type { FantasySyncResult } from "@/lib/providers/fantasy/base";
import { getDemoEpochOffsetMs, getSleeperConnection } from "./session";

/**
 * Server-side snapshot assembly: picks the right fantasy + live providers,
 * joins their data, and returns one PortfolioSnapshot for the UI.
 *
 * Provider priority (per product spec):
 *   Fantasy: Sleeper (when connected) -> Demo
 *   Live NFL: Sportradar (when SPORTRADAR_API_KEY) ->
 *             Sleeper's real weekly stats/schedule (always, for Sleeper users)
 */

export async function getPortfolioSnapshot(): Promise<PortfolioSnapshot> {
  const sleeper = await getSleeperConnection();

  if (!sleeper) {
    // Demo world (fantasy + live simulated together, clearly labeled).
    const offset = await getDemoEpochOffsetMs();
    return buildDemoSnapshot(Date.now(), offset);
  }

  return buildSleeperSnapshot(sleeper.username, sleeper.lastSyncedAt);
}

async function buildSleeperSnapshot(
  username: string,
  lastSyncedAt: string | null
): Promise<PortfolioSnapshot> {
  const sync: FantasySyncResult = await sleeperProvider.syncUserFantasyData(username);

  const connections: FantasyConnectionInfo[] = [
    {
      provider: "sleeper",
      providerUsername: username,
      status: "connected",
      lastSyncedAt: sync.syncedAt ?? lastSyncedAt,
    },
    {
      provider: "yahoo",
      providerUsername: null,
      status: yahooProvider.isConfigured() ? "disconnected" : "needs_config",
      lastSyncedAt: null,
    },
    { provider: "espn", providerUsername: null, status: "coming_soon", lastSyncedAt: null },
  ];

  let games: NormalizedNFLGame[] = [];
  let playerStats: NormalizedPlayerGameStats[] = [];
  let alerts: PortfolioAlert[] = [];
  let liveSource: PortfolioSnapshot["meta"]["liveSource"] = "none";

  if (sportradarProvider.isConfigured()) {
    liveSource = "sportradar";
    try {
      const schedule = await sportradarProvider.getSchedule();
      // Only fetch stats for games that contain the user's players.
      const userTeamIds = new Set(sync.teams.filter((t) => t.isUserTeam).map((t) => t.id));
      const ownedPlayerIds = new Set(
        sync.rosterSlots.filter((s) => userTeamIds.has(s.fantasyTeamId)).map((s) => s.playerId)
      );
      const ownedNflTeams = new Set(
        sync.players.filter((p) => ownedPlayerIds.has(p.id)).map((p) => p.nflTeam)
      );
      games = schedule;
      const relevantGames = schedule.filter(
        (g) =>
          g.status !== "scheduled" &&
          (ownedNflTeams.has(g.homeTeam) || ownedNflTeams.has(g.awayTeam))
      );
      const rawStats = await sportradarProvider.getPlayerGameStats(relevantGames.map((g) => g.id));
      playerStats = mapStatsToCanonical(rawStats, sync.players);
      alerts = collectLiveAlerts(username, { games, stats: playerStats }, sync);
    } catch (err) {
      // Live data failing must never take down the fantasy view — but the
      // snapshot must not claim a live source it doesn't have.
      console.warn("[live] Sportradar refresh failed:", err instanceof Error ? err.message : err);
      games = [];
      playerStats = [];
      liveSource = "none";
    }
  } else {
    // Real, current-week data straight from Sleeper's public API: raw
    // per-player stat lines (scored locally per league), game statuses from
    // the schedule, and projections for real projected totals.
    try {
      const neededSleeperIds = new Set(
        sync.players
          .map((p) => p.providerIds.sleeper)
          .filter((id): id is string => Boolean(id))
      );
      const [schedule, weekStats, projections] = await Promise.all([
        sleeperLiveProvider.getSchedule(sync.season, sync.week),
        sleeperLiveProvider.getWeekStats(sync.season, sync.week, neededSleeperIds),
        sleeperLiveProvider.getWeekProjections(sync.season, sync.week, neededSleeperIds),
      ]);
      games = schedule;

      const gameByTeam = new Map<string, NormalizedNFLGame>();
      for (const g of schedule) {
        gameByTeam.set(g.homeTeam, g);
        gameByTeam.set(g.awayTeam, g);
      }
      const updatedAt = new Date().toISOString();
      playerStats = [];
      for (const player of sync.players) {
        const sleeperId = player.providerIds.sleeper;
        const stats = sleeperId ? weekStats.get(sleeperId) : undefined;
        if (!stats) continue;
        const game = gameByTeam.get(player.nflTeam);
        playerStats.push({
          playerId: player.id,
          gameId: game?.id ?? `slg-w${sync.week}-${player.nflTeam}`,
          stats,
          updatedAt,
        });
      }

      liveSource = "sleeper";
      alerts = collectLiveAlerts(username, { games, stats: playerStats }, sync);
      applyProjections(sync, projections);
    } catch (err) {
      console.warn(
        "[live] Sleeper stats refresh failed:",
        err instanceof Error ? err.message : err
      );
      games = [];
      playerStats = [];
      liveSource = "none";
    }
  }

  return {
    meta: {
      mode: liveSource === "none" ? "mixed" : "live",
      fantasySource: "sleeper",
      liveSource,
      week: sync.week,
      season: sync.season,
      generatedAt: new Date().toISOString(),
      connections,
    },
    leagues: sync.leagues,
    fantasyTeams: sync.teams,
    players: sync.players,
    rosterSlots: sync.rosterSlots,
    matchups: sync.matchups,
    games,
    playerStats,
    alerts,
  };
}

/**
 * Replace Sleeper's degenerate "projected = current points" shim with real
 * projections: each team's projected total is the sum of its starters'
 * projected stat lines scored under that league's own settings.
 */
function applyProjections(
  sync: FantasySyncResult,
  projections: Map<string, RawStatLine>
): void {
  if (projections.size === 0) return;
  const leagueById = new Map(sync.leagues.map((l) => [l.id, l]));
  const playerById = new Map(sync.players.map((p) => [p.id, p]));

  const projectTeam = (teamId: string, leagueId: string): number | null => {
    const league = leagueById.get(leagueId);
    if (!league) return null;
    let total = 0;
    let matched = 0;
    for (const slot of sync.rosterSlots) {
      if (slot.fantasyTeamId !== teamId || !slot.isStarter) continue;
      const sleeperId = playerById.get(slot.playerId)?.providerIds.sleeper;
      const proj = sleeperId ? projections.get(sleeperId) : undefined;
      if (!proj) continue;
      matched += 1;
      total += calculateFantasyPoints(proj, league.scoringSettings);
    }
    return matched > 0 ? round1(total) : null;
  };

  for (const matchup of sync.matchups) {
    const user = projectTeam(matchup.userTeamId, matchup.leagueId);
    const opp = projectTeam(matchup.opponentTeamId, matchup.leagueId);
    if (user !== null) matchup.userProjected = user;
    if (opp !== null) matchup.opponentProjected = opp;
  }
}

// ---------------------------------------------------------------------------
// Player ID mapping: live-provider stats -> canonical players
// ---------------------------------------------------------------------------

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(jr|sr|ii|iii|iv|v)\b\.?/g, "")
    .replace(/[^a-z]/g, "");
}

/**
 * Map provider-scoped stat entries to canonical players.
 *
 * 1. Prefer direct external-ID mapping (providerIds.sportradar).
 * 2. Fall back to a conservative name+team(+position) match.
 * 3. Never merge ambiguous players — log and drop instead.
 */
export function mapStatsToCanonical(
  rawStats: NormalizedPlayerGameStats[],
  players: NormalizedPlayer[]
): NormalizedPlayerGameStats[] {
  const bySportradarId = new Map<string, NormalizedPlayer>();
  const byNameTeam = new Map<string, NormalizedPlayer[]>();
  for (const p of players) {
    if (p.providerIds.sportradar) bySportradarId.set(p.providerIds.sportradar, p);
    const key = `${normalizeName(p.fullName)}|${p.nflTeam}`;
    const list = byNameTeam.get(key) ?? [];
    list.push(p);
    byNameTeam.set(key, list);
  }

  const out: NormalizedPlayerGameStats[] = [];
  const unmatched: string[] = [];
  for (const entry of rawStats) {
    const providerId = entry.playerId.replace(/^sr-player-/, "");
    let canonical = bySportradarId.get(providerId);
    if (!canonical && entry.playerName && entry.nflTeam) {
      const candidates = byNameTeam.get(`${normalizeName(entry.playerName)}|${entry.nflTeam}`) ?? [];
      const posFiltered = entry.position
        ? candidates.filter((c) => c.position === entry.position)
        : candidates;
      const pool = posFiltered.length > 0 ? posFiltered : candidates;
      if (pool.length === 1) {
        canonical = pool[0];
      } else if (pool.length > 1) {
        unmatched.push(`${entry.playerName} (ambiguous: ${pool.length} candidates)`);
        continue;
      }
    }
    if (!canonical) {
      // Not a rostered player (most stats belong to unowned players) — skip
      // silently unless we had a name we expected to match.
      continue;
    }
    out.push({ ...entry, playerId: canonical.id });
  }
  if (unmatched.length > 0) {
    console.warn(`[mapping] ${unmatched.length} ambiguous players left unmatched:`, unmatched.slice(0, 10));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Real-mode alert accumulation (diff consecutive live states per user)
// ---------------------------------------------------------------------------

// Player-first feed: keep ONE entry per player — his latest point-moving
// event — so the feed reads "what has each of my players just done".
const liveStateStore = new Map<
  string,
  { prev: LiveState; byPlayer: Map<string, PortfolioAlert> }
>();

function collectLiveAlerts(
  userKey: string,
  next: LiveState,
  sync: FantasySyncResult
): PortfolioAlert[] {
  const entry = liveStateStore.get(userKey);
  const userTeamIds = new Set(sync.teams.filter((t) => t.isUserTeam).map((t) => t.id));
  const userSlots = sync.rosterSlots.filter((s) => userTeamIds.has(s.fantasyTeamId));
  const byPlayer = entry?.byPlayer ?? new Map<string, PortfolioAlert>();
  if (entry) {
    const fresh = deriveLiveAlerts(entry.prev, next, {
      players: sync.players,
      userSlots,
      leagues: sync.leagues,
    });
    for (const alert of fresh) {
      if (!alert.playerId) continue;
      const existing = byPlayer.get(alert.playerId);
      // A touchdown shouldn't be instantly overwritten by a trivial update.
      const rank = (a: PortfolioAlert) => (a.type === "touchdown" ? 2 : a.type === "big_play" ? 1 : 0);
      if (existing && rank(existing) > rank(alert) && Date.now() - new Date(existing.at).getTime() < 120_000) {
        continue;
      }
      byPlayer.set(alert.playerId, alert);
    }
  }
  liveStateStore.set(userKey, { prev: next, byPlayer });
  if (liveStateStore.size > 500) {
    const firstKey = liveStateStore.keys().next().value;
    if (firstKey) liveStateStore.delete(firstKey);
  }
  return [...byPlayer.values()].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 25);
}
