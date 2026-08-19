import type {
  NormalizedFantasyTeam,
  NormalizedLeague,
  NormalizedMatchup,
  NormalizedPlayer,
  NormalizedRosterSlot,
  Position,
  ScoringSettings,
} from "@/lib/types";
import { classifyScoring } from "@/lib/scoring/engine";
import {
  FantasyProvider,
  FantasyProviderError,
  FantasySyncResult,
  FantasyUser,
} from "./base";

/**
 * Sleeper fantasy provider — real integration against Sleeper's documented
 * public API (https://docs.sleeper.com). Read-only, no auth required.
 *
 * All requests happen server-side. Responses are normalized into the app's
 * internal types; components never see raw Sleeper payloads.
 */

const BASE = "https://api.sleeper.app/v1";

// --- tiny in-memory TTL cache (per server instance) ------------------------

const cache = new Map<string, { expires: number; data: unknown }>();

async function sleeperGet<T>(path: string, ttlMs: number): Promise<T> {
  const key = `sleeper:${path}`;
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.data as T;

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { headers: { accept: "application/json" } });
  } catch (err) {
    throw new FantasyProviderError(
      `Network error reaching Sleeper: ${err instanceof Error ? err.message : String(err)}`,
      "network"
    );
  }
  if (res.status === 429) {
    throw new FantasyProviderError("Sleeper rate limit reached — try again shortly.", "rate_limited");
  }
  if (res.status === 404) {
    throw new FantasyProviderError("Not found on Sleeper.", "user_not_found");
  }
  if (!res.ok) {
    throw new FantasyProviderError(`Sleeper API error (${res.status}).`, "network");
  }
  const data = (await res.json()) as T;
  if (data !== null) cache.set(key, { expires: Date.now() + ttlMs, data });
  return data;
}

// --- raw Sleeper shapes (internal to this module only) ----------------------

interface SleeperState {
  week: number;
  season: string;
  season_type: string;
  display_week?: number;
}
interface SleeperUser {
  user_id: string;
  username: string;
  display_name: string;
}
interface SleeperLeague {
  league_id: string;
  name: string;
  season: string;
  total_rosters: number;
  scoring_settings: Record<string, number>;
  roster_positions: string[];
  settings?: { leg?: number };
}
interface SleeperRoster {
  roster_id: number;
  owner_id: string | null;
  players: string[] | null;
  starters: string[] | null;
  settings?: { wins?: number; losses?: number; ties?: number };
}
interface SleeperLeagueUser {
  user_id: string;
  display_name: string;
  metadata?: { team_name?: string };
}
interface SleeperMatchup {
  roster_id: number;
  matchup_id: number | null;
  points: number;
  players: string[] | null;
  starters: string[] | null;
  players_points?: Record<string, number>;
}
interface SleeperPlayerEntry {
  player_id?: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  position?: string;
  team?: string | null;
  status?: string;
  injury_status?: string | null;
  sportradar_id?: string | null;
  espn_id?: number | string | null;
  yahoo_id?: number | string | null;
  gsis_id?: string | null;
}

const PLAYER_DIR_TTL = 24 * 60 * 60 * 1000; // the directory is large; refresh daily
const STATE_TTL = 5 * 60 * 1000;
const LEAGUE_TTL = 5 * 60 * 1000;
const ROSTER_TTL = 60 * 1000;

const VALID_POSITIONS = new Set<Position>(["QB", "RB", "WR", "TE", "K", "DST"]);

function canonicalId(sleeperId: string): string {
  return `slp-${sleeperId}`;
}

function normalizePlayerEntry(sleeperId: string, entry: SleeperPlayerEntry | undefined): NormalizedPlayer {
  // Team defenses are keyed by team abbreviation ("SEA") in Sleeper rosters.
  if (!entry || /^[A-Z]{2,3}$/.test(sleeperId)) {
    const team = sleeperId;
    return {
      id: canonicalId(sleeperId),
      firstName: team,
      lastName: "D/ST",
      fullName: `${team} D/ST`,
      position: "DST",
      nflTeam: team,
      status: "active",
      providerIds: { sleeper: sleeperId },
    };
  }
  const rawPos = entry.position === "DEF" ? "DST" : entry.position;
  const position: Position = VALID_POSITIONS.has(rawPos as Position) ? (rawPos as Position) : "WR";
  const providerIds: NormalizedPlayer["providerIds"] = { sleeper: sleeperId };
  // Persist external IDs Sleeper exposes — these join fantasy players to
  // live NFL data providers (Sportradar first).
  if (entry.sportradar_id) providerIds.sportradar = String(entry.sportradar_id);
  if (entry.espn_id) providerIds.espn = String(entry.espn_id);
  if (entry.yahoo_id) providerIds.yahoo = String(entry.yahoo_id);
  if (entry.gsis_id) providerIds.gsis = String(entry.gsis_id).trim();
  const status =
    entry.injury_status === "Out"
      ? "out"
      : entry.injury_status === "Questionable"
        ? "questionable"
        : entry.status === "Active"
          ? "active"
          : "unknown";
  return {
    id: canonicalId(sleeperId),
    firstName: entry.first_name ?? "",
    lastName: entry.last_name ?? "",
    fullName: entry.full_name ?? `${entry.first_name ?? ""} ${entry.last_name ?? ""}`.trim(),
    position,
    nflTeam: entry.team ?? "FA",
    status,
    providerIds,
  };
}

export class SleeperFantasyProvider implements FantasyProvider {
  readonly id = "sleeper" as const;
  readonly displayName = "Sleeper";

  isConfigured(): boolean {
    return true; // public API — always available
  }

  async getState(): Promise<{ week: number; season: number }> {
    const state = await sleeperGet<SleeperState>("/state/nfl", STATE_TTL);
    return { week: state.display_week ?? state.week, season: Number(state.season) };
  }

  async getUser(identifier: string): Promise<FantasyUser> {
    const clean = identifier.trim().toLowerCase();
    if (!/^[a-z0-9_]{1,32}$/i.test(clean)) {
      throw new FantasyProviderError("That doesn't look like a valid Sleeper username.", "user_not_found");
    }
    let user: SleeperUser | null;
    try {
      user = await sleeperGet<SleeperUser | null>(`/user/${encodeURIComponent(clean)}`, 60 * 60 * 1000);
    } catch (err) {
      if (err instanceof FantasyProviderError && err.code === "user_not_found") {
        throw new FantasyProviderError(`Sleeper user "${identifier}" not found.`, "user_not_found");
      }
      throw err;
    }
    if (!user?.user_id) {
      throw new FantasyProviderError(`Sleeper user "${identifier}" not found.`, "user_not_found");
    }
    return { providerUserId: user.user_id, username: user.username, displayName: user.display_name };
  }

  async getLeagues(providerUserId: string, season: number): Promise<NormalizedLeague[]> {
    const leagues = await sleeperGet<SleeperLeague[] | null>(
      `/user/${providerUserId}/leagues/nfl/${season}`,
      LEAGUE_TTL
    );
    return (leagues ?? []).map((l) => this.normalizeLeague(l));
  }

  private normalizeLeague(l: SleeperLeague): NormalizedLeague {
    const scoringSettings: ScoringSettings = l.scoring_settings ?? {};
    return {
      id: `slg-${l.league_id}`,
      provider: "sleeper",
      providerLeagueId: l.league_id,
      name: l.name,
      season: Number(l.season),
      week: l.settings?.leg ?? 0,
      totalTeams: l.total_rosters,
      scoringType: classifyScoring(scoringSettings),
      scoringSettings,
      lastSyncedAt: new Date().toISOString(),
    };
  }

  async getScoringSettings(providerLeagueId: string): Promise<ScoringSettings> {
    const league = await sleeperGet<SleeperLeague>(`/league/${providerLeagueId}`, LEAGUE_TTL);
    return league.scoring_settings ?? {};
  }

  /**
   * Fetch the (large) Sleeper player directory, cached for 24h, and return
   * only the entries requested.
   */
  private async getPlayerEntries(ids: Set<string>): Promise<Map<string, SleeperPlayerEntry>> {
    const dir = await sleeperGet<Record<string, SleeperPlayerEntry>>("/players/nfl", PLAYER_DIR_TTL);
    const out = new Map<string, SleeperPlayerEntry>();
    for (const id of ids) {
      if (dir[id]) out.set(id, dir[id]);
    }
    return out;
  }

  async syncUserFantasyData(identifier: string): Promise<FantasySyncResult> {
    const warnings: string[] = [];
    const { week, season } = await this.getState();
    const user = await this.getUser(identifier);
    const rawLeagues = await sleeperGet<SleeperLeague[] | null>(
      `/user/${user.providerUserId}/leagues/nfl/${season}`,
      LEAGUE_TTL
    );
    if (!rawLeagues || rawLeagues.length === 0) {
      throw new FantasyProviderError(
        `"${user.displayName}" has no Sleeper leagues for the ${season} NFL season.`,
        "no_leagues"
      );
    }

    const leagues: NormalizedLeague[] = [];
    const teams: NormalizedFantasyTeam[] = [];
    const rosterSlots: NormalizedRosterSlot[] = [];
    const matchups: NormalizedMatchup[] = [];
    const neededPlayerIds = new Set<string>();
    let slotSeq = 0;

    // Fetch per-league data concurrently (3 requests per league).
    const perLeague = await Promise.all(
      rawLeagues.map(async (raw) => {
        const [rosters, users, weekMatchups] = await Promise.all([
          sleeperGet<SleeperRoster[]>(`/league/${raw.league_id}/rosters`, ROSTER_TTL),
          sleeperGet<SleeperLeagueUser[]>(`/league/${raw.league_id}/users`, LEAGUE_TTL),
          sleeperGet<SleeperMatchup[] | null>(`/league/${raw.league_id}/matchups/${week}`, ROSTER_TTL),
        ]);
        return { raw, rosters, users, weekMatchups: weekMatchups ?? [] };
      })
    );

    for (const { raw, rosters, users, weekMatchups } of perLeague) {
      const league = this.normalizeLeague(raw);
      league.week = week;
      leagues.push(league);

      const userRoster = rosters.find((r) => r.owner_id === user.providerUserId);
      if (!userRoster) {
        warnings.push(`Could not find your roster in "${raw.name}" — skipped.`);
        continue;
      }
      const usersById = new Map(users.map((u) => [u.user_id, u]));

      const teamFor = (roster: SleeperRoster, isUserTeam: boolean): NormalizedFantasyTeam => {
        const owner = roster.owner_id ? usersById.get(roster.owner_id) : undefined;
        return {
          id: `st-${raw.league_id}-${roster.roster_id}`,
          leagueId: league.id,
          providerRosterId: String(roster.roster_id),
          name: owner?.metadata?.team_name || owner?.display_name || `Roster ${roster.roster_id}`,
          ownerName: isUserTeam ? "You" : owner?.display_name ?? "Unknown",
          isUserTeam,
          record: roster.settings
            ? {
                wins: roster.settings.wins ?? 0,
                losses: roster.settings.losses ?? 0,
                ties: roster.settings.ties ?? 0,
              }
            : undefined,
        };
      };

      const userMatchup = weekMatchups.find((m) => m.roster_id === userRoster.roster_id);
      const opponentMatchup = userMatchup?.matchup_id
        ? weekMatchups.find(
            (m) => m.matchup_id === userMatchup.matchup_id && m.roster_id !== userRoster.roster_id
          )
        : undefined;
      const opponentRoster = opponentMatchup
        ? rosters.find((r) => r.roster_id === opponentMatchup.roster_id)
        : undefined;

      const userTeam = teamFor(userRoster, true);
      teams.push(userTeam);
      let opponentTeam: NormalizedFantasyTeam | undefined;
      if (opponentRoster) {
        opponentTeam = teamFor(opponentRoster, false);
        teams.push(opponentTeam);
      } else if (userMatchup) {
        warnings.push(`No head-to-head opponent found this week in "${raw.name}".`);
      }

      const slotLabels = (raw.roster_positions ?? []).filter((p) => p !== "BN" && p !== "IR");
      const addSlots = (
        teamId: string,
        matchup: SleeperMatchup | undefined,
        roster: SleeperRoster
      ) => {
        const starters = (matchup?.starters ?? roster.starters ?? []).filter((p) => p && p !== "0");
        const all = (matchup?.players ?? roster.players ?? []).filter((p) => p && p !== "0");
        const points = matchup?.players_points ?? {};
        const starterSet = new Set(starters);
        starters.forEach((playerId, i) => {
          neededPlayerIds.add(playerId);
          rosterSlots.push({
            id: `ss-${++slotSeq}`,
            fantasyTeamId: teamId,
            leagueId: league.id,
            playerId: canonicalId(playerId),
            slot: slotLabels[i] === "DEF" ? "DST" : slotLabels[i] ?? "FLEX",
            isStarter: true,
            week,
            providerPoints: points[playerId] ?? 0,
          });
        });
        for (const playerId of all) {
          if (starterSet.has(playerId)) continue;
          neededPlayerIds.add(playerId);
          rosterSlots.push({
            id: `ss-${++slotSeq}`,
            fantasyTeamId: teamId,
            leagueId: league.id,
            playerId: canonicalId(playerId),
            slot: "BN",
            isStarter: false,
            week,
            providerPoints: points[playerId] ?? 0,
          });
        }
      };

      addSlots(userTeam.id, userMatchup, userRoster);
      if (opponentTeam && opponentRoster) addSlots(opponentTeam.id, opponentMatchup, opponentRoster);

      if (userMatchup && opponentMatchup && opponentTeam) {
        matchups.push({
          id: `sm-${raw.league_id}-${week}`,
          leagueId: league.id,
          week,
          userTeamId: userTeam.id,
          opponentTeamId: opponentTeam.id,
          userScore: userMatchup.points ?? 0,
          opponentScore: opponentMatchup.points ?? 0,
          userProjected: userMatchup.points ?? 0,
          opponentProjected: opponentMatchup.points ?? 0,
          winProbability: null, // Sleeper's public API has no win probability
          status: "tossup",
        });
      }
    }

    // Resolve canonical players (with external IDs for live-data mapping).
    const entries = await this.getPlayerEntries(neededPlayerIds);
    const players: NormalizedPlayer[] = [];
    for (const sleeperId of neededPlayerIds) {
      players.push(normalizePlayerEntry(sleeperId, entries.get(sleeperId)));
      if (!entries.get(sleeperId) && !/^[A-Z]{2,3}$/.test(sleeperId)) {
        warnings.push(`Unknown Sleeper player id ${sleeperId} — kept as unmatched.`);
      }
    }

    return {
      user,
      leagues,
      teams,
      players,
      rosterSlots,
      matchups,
      season,
      week,
      syncedAt: new Date().toISOString(),
      warnings,
    };
  }
}

export const sleeperProvider = new SleeperFantasyProvider();
