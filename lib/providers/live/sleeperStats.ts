import type {
  GameStatus,
  NormalizedNFLGame,
  NormalizedPlayerGameStats,
  RawStatLine,
} from "@/lib/types";
import { LiveProviderError, LiveSportsProvider } from "./base";

/**
 * Sleeper live-stats provider — real, current-week NFL data with no API key.
 *
 * Sleeper's public, unauthenticated API (the same host the fantasy provider
 * uses) also serves per-player weekly stat lines, projections, and the NFL
 * schedule with game statuses. Stats arrive in Sleeper stat-key format
 * (pass_yd, rec, rec_td, …), which is exactly what the local scoring engine
 * consumes — so every league's own settings produce real fantasy points.
 *
 * Live score, quarter, clock and possession come from Sleeper's scores feed
 * when it answers; field position (ball yard line, down & distance) is
 * Sportradar territory and stays null here. The UI degrades gracefully.
 */

const HOST = "https://api.sleeper.app";

const cache = new Map<string, { expires: number; data: unknown }>();

async function sleeperGet<T>(path: string, ttlMs: number): Promise<T> {
  const key = `slive:${path}`;
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.data as T;
  let res: Response;
  try {
    res = await fetch(`${HOST}${path}`, { headers: { accept: "application/json" } });
  } catch (err) {
    throw new LiveProviderError(
      `Network error reaching Sleeper: ${err instanceof Error ? err.message : String(err)}`,
      "network"
    );
  }
  if (res.status === 429) throw new LiveProviderError("Sleeper rate limit reached.", "rate_limited");
  if (!res.ok) throw new LiveProviderError(`Sleeper API error (${res.status}).`, "network");
  const data = (await res.json()) as T;
  if (data !== null) cache.set(key, { expires: Date.now() + ttlMs, data });
  return data;
}

// ---------------------------------------------------------------------------
// Pure normalization helpers (unit tested)
// ---------------------------------------------------------------------------

/** Sleeper schedule sometimes uses different team codes than its player data. */
const TEAM_ALIASES: Record<string, string> = { WSH: "WAS", JAC: "JAX", OAK: "LV", SD: "LAC", STL: "LAR" };

export function canonTeam(team: string | undefined | null): string | null {
  if (!team) return null;
  const t = String(team).toUpperCase();
  return TEAM_ALIASES[t] ?? t;
}

function normalizeGameStatus(status: unknown): GameStatus {
  switch (String(status ?? "").toLowerCase()) {
    case "in_game":
    case "in_progress":
    case "live":
      return "live";
    case "halftime":
    case "half":
      return "halftime";
    case "complete":
    case "completed":
    case "post_game":
    case "final":
      return "final";
    default:
      return "scheduled";
  }
}

/** Sleeper's scores feed nests live detail under `metadata`; read both. */
function pick(raw: Json, keys: string[]): unknown {
  const meta = raw?.metadata && typeof raw.metadata === "object" ? raw.metadata : {};
  for (const k of keys) {
    if (raw?.[k] !== undefined && raw?.[k] !== null) return raw[k];
    if (meta?.[k] !== undefined && meta?.[k] !== null) return meta[k];
  }
  return undefined;
}

/** A real kickoff never lands on exactly midnight UTC — that's a date-only value. */
function isMidnightUtc(d: Date): boolean {
  return d.getUTCHours() === 0 && d.getUTCMinutes() === 0 && d.getUTCSeconds() === 0;
}

/* eslint-disable @typescript-eslint/no-explicit-any -- external payloads parsed defensively */
type Json = any;
/* eslint-enable @typescript-eslint/no-explicit-any */

export function normalizeScheduleGame(raw: Json, week: number): NormalizedNFLGame | null {
  const home = canonTeam(raw?.home ?? raw?.home_team ?? raw?.homeTeam);
  const away = canonTeam(raw?.away ?? raw?.away_team ?? raw?.awayTeam);
  if (!home || !away) return null;
  const status = normalizeGameStatus(raw?.status);
  // Kickoff: prefer a real timestamp (epoch or ISO datetime); a date-only
  // string still anchors the game to its day, but the TIME is unknown and
  // must never be displayed as if it were real.
  let kickoffAt = new Date().toISOString();
  let kickoffTimeKnown = false;
  let kickoffDate: string | null = null;
  const dateOnly = (ymd: string) => {
    kickoffDate = ymd;
    kickoffTimeKnown = false;
    // Placeholder instant for chronological ordering only (~1pm ET).
    kickoffAt = `${ymd}T17:00:00.000Z`;
  };
  const timestamp = (d: Date) => {
    if (isMidnightUtc(d)) dateOnly(d.toISOString().slice(0, 10));
    else {
      kickoffAt = d.toISOString();
      kickoffTimeKnown = true;
    }
  };
  for (const cand of [pick(raw, ["start_time", "kickoff", "scheduled"]), raw?.date]) {
    if (typeof cand === "number" && Number.isFinite(cand) && cand > 1e9) {
      const d = new Date(cand > 1e12 ? cand : cand * 1000);
      if (!Number.isNaN(d.getTime())) {
        timestamp(d);
        break;
      }
    } else if (typeof cand === "string" && cand) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(cand)) {
        dateOnly(cand);
        break;
      }
      const d = new Date(cand);
      if (!Number.isNaN(d.getTime())) {
        timestamp(d);
        break;
      }
    }
  }
  const live = status === "live" || status === "halftime";
  const quarterRaw = live ? Number(pick(raw, ["quarter_num", "quarter", "period"])) : NaN;
  const clockRaw = live ? pick(raw, ["time_remaining", "clock", "game_clock"]) : undefined;
  const possession = live ? canonTeam(String(pick(raw, ["possession", "possession_team"]) ?? "")) : null;
  const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  return {
    id: `slg-${raw?.game_id ?? `${away}-${home}-${week}`}`,
    providerGameId: String(raw?.game_id ?? `${away}-${home}-${week}`),
    week,
    homeTeam: home,
    awayTeam: away,
    homeScore: num(Number(pick(raw, ["home_score", "home_points"]) ?? 0)),
    awayScore: num(Number(pick(raw, ["away_score", "away_points"]) ?? 0)),
    status,
    // Sleeper's scores feed carries quarter/clock/possession while a game is
    // on; its plain schedule feed doesn't. Field position needs Sportradar.
    quarter: Number.isFinite(quarterRaw) && quarterRaw > 0 ? quarterRaw : null,
    clock: typeof clockRaw === "string" && clockRaw ? clockRaw : null,
    possessionTeam: possession,
    ballYardLine: null,
    down: null,
    distance: null,
    redZone: false,
    kickoffAt,
    kickoffTimeKnown,
    kickoffDate,
    driveSummary: null,
    updatedAt: new Date().toISOString(),
  };
}

/** Stat keys that aren't raw football stats (fantasy-point totals, ranks,
 *  meta). NOTE: `pts_allow` / `pts_allow_7_13` are real D/ST stats — keep them. */
const FANTASY_POINT_KEYS = /^pts_(ppr|half_ppr|std|idp|.*_ppr|.*_std)$/;
function isRawStatKey(key: string): boolean {
  return !(
    FANTASY_POINT_KEYS.test(key) ||
    key.startsWith("rank_") ||
    key.startsWith("pos_rank_") ||
    key.startsWith("adp_") ||
    key === "gp" ||
    key === "gms_active" ||
    key === "tm_off_snp" ||
    key === "tm_def_snp" ||
    key === "tm_st_snp"
  );
}

/**
 * Normalize a Sleeper week-stats (or projections) payload into stat lines
 * for the requested Sleeper player ids. Accepts both payload shapes Sleeper
 * has used: a map of playerId -> stats, or an array of {player_id, stats}.
 */
export function normalizeWeekStats(
  payload: unknown,
  neededSleeperIds: Set<string>
): Map<string, RawStatLine> {
  const out = new Map<string, RawStatLine>();
  const push = (playerId: unknown, stats: unknown) => {
    const id = String(playerId ?? "");
    if (!id || !neededSleeperIds.has(id)) return;
    if (!stats || typeof stats !== "object") return;
    const line: RawStatLine = {};
    for (const [k, v] of Object.entries(stats as Record<string, unknown>)) {
      if (typeof v !== "number" || !Number.isFinite(v) || v === 0) continue;
      if (!isRawStatKey(k)) continue;
      line[k] = v;
    }
    if (Object.keys(line).length > 0) out.set(id, line);
  };

  if (Array.isArray(payload)) {
    for (const item of payload as Json[]) push(item?.player_id, item?.stats ?? item);
  } else if (payload && typeof payload === "object") {
    for (const [id, stats] of Object.entries(payload as Record<string, unknown>)) push(id, stats);
  }
  return out;
}

/**
 * Normalize any known schedule payload shape into this week's games:
 * a plain array, `{ games: [...] }`, or an object keyed by game id. A
 * season-wide payload carries every week — entries with a `week` field that
 * doesn't match are dropped; entries without one are kept as-is.
 */
export function normalizeSchedulePayload(raw: Json, week: number): NormalizedNFLGame[] {
  const entries: Json[] = Array.isArray(raw)
    ? raw
    : Array.isArray(raw?.games)
      ? raw.games
      : raw && typeof raw === "object"
        ? Object.values(raw)
        : [];
  return entries
    .filter((e: Json) => e?.week === undefined || Number(e?.week) === week)
    .map((g: Json) => normalizeScheduleGame(g, week))
    .filter((g): g is NormalizedNFLGame => g !== null);
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

const STATE_TTL = 5 * 60 * 1000;
const SCHEDULE_TTL = 30 * 1000;
const STATS_TTL = 30 * 1000; // live-ish during games
const PROJECTIONS_TTL = 30 * 60 * 1000;

export class SleeperStatsLiveProvider implements LiveSportsProvider {
  readonly id = "sleeper" as const;

  isConfigured(): boolean {
    return true; // public API — always available
  }

  async getCurrentWeek(): Promise<{ season: number; week: number }> {
    const state = await sleeperGet<Json>("/v1/state/nfl", STATE_TTL);
    return { season: Number(state?.season), week: state?.display_week ?? state?.week ?? 1 };
  }

  async getSchedule(season: number, week: number): Promise<NormalizedNFLGame[]> {
    // Sleeper's schedule lives at an unversioned path whose exact shape has
    // varied; try each known candidate and accept array/object payloads.
    const candidates = [
      // Scores feed first: real kickoff timestamps plus live score/clock.
      `/scores/nfl/regular/${season}/${week}`,
      `/schedule/nfl/regular/${season}/${week}`,
      `/v1/schedule/nfl/regular/${season}/${week}`,
      `/schedule/nfl/regular/${season}`,
    ];
    for (const path of candidates) {
      try {
        const raw = await sleeperGet<Json>(path, SCHEDULE_TTL);
        const thisWeek = normalizeSchedulePayload(raw, week);
        if (thisWeek.length > 0) return thisWeek;
      } catch {
        // try the next candidate
      }
    }
    // Schedule is best-effort — stats and scoring work without it.
    return [];
  }

  async getLiveGames(): Promise<NormalizedNFLGame[]> {
    const { season, week } = await this.getCurrentWeek();
    return (await this.getSchedule(season, week)).filter((g) => g.status === "live");
  }

  async getGame(gameId: string): Promise<NormalizedNFLGame | null> {
    const { season, week } = await this.getCurrentWeek();
    return (await this.getSchedule(season, week)).find((g) => g.id === gameId) ?? null;
  }

  /** Real weekly raw stat lines for the given Sleeper player ids. */
  async getWeekStats(
    season: number,
    week: number,
    neededSleeperIds: Set<string>
  ): Promise<Map<string, RawStatLine>> {
    const raw = await sleeperGet<Json>(`/v1/stats/nfl/regular/${season}/${week}`, STATS_TTL);
    return normalizeWeekStats(raw, neededSleeperIds);
  }

  /** Projected stat lines (scored locally per league for real projections). */
  async getWeekProjections(
    season: number,
    week: number,
    neededSleeperIds: Set<string>
  ): Promise<Map<string, RawStatLine>> {
    try {
      const raw = await sleeperGet<Json>(
        `/v1/projections/nfl/regular/${season}/${week}`,
        PROJECTIONS_TTL
      );
      return normalizeWeekStats(raw, neededSleeperIds);
    } catch {
      return new Map();
    }
  }

  /** Interface form: all stats for the current week as canonical entries. */
  async getPlayerGameStats(gameIds: string[]): Promise<NormalizedPlayerGameStats[]> {
    void gameIds; // Sleeper stats are per-week, not per-game
    return [];
  }
}

export const sleeperLiveProvider = new SleeperStatsLiveProvider();
