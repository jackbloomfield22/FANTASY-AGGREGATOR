import type {
  GameStatus,
  NormalizedNFLGame,
  NormalizedPlayerGameStats,
  RawStatLine,
} from "@/lib/types";
import { LiveProviderError, LiveSportsProvider } from "./base";

/**
 * Sportradar NFL provider — the primary production live-data integration.
 *
 * Enabled by setting SPORTRADAR_API_KEY (server-side only; the key is never
 * shipped to the client). Uses the current official NFL API (v7):
 *   https://developer.sportradar.com/football/reference/nfl-overview
 *
 * Endpoints used:
 *   GET /nfl/official/{access}/v7/en/games/current_week/schedule.json
 *   GET /nfl/official/{access}/v7/en/games/{game_id}/boxscore.json
 *   GET /nfl/official/{access}/v7/en/games/{game_id}/statistics.json
 *
 * Player stats arrive batched per game — never one request per fantasy
 * player. Sportradar player IDs are matched to canonical players through
 * providerIds.sportradar (populated from Sleeper's directory), with a
 * conservative name+team+position fallback in the assembly layer.
 */

const ACCESS = process.env.SPORTRADAR_ACCESS_LEVEL ?? "trial";
const BASE = `https://api.sportradar.com/nfl/official/${ACCESS}/v7/en`;

const cache = new Map<string, { expires: number; data: unknown }>();

async function srGet<T>(path: string, ttlMs: number): Promise<T> {
  const key = process.env.SPORTRADAR_API_KEY;
  if (!key) throw new LiveProviderError("SPORTRADAR_API_KEY is not set.", "not_configured");
  const cacheKey = `sr:${path}`;
  const hit = cache.get(cacheKey);
  if (hit && hit.expires > Date.now()) return hit.data as T;

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}?api_key=${encodeURIComponent(key)}`, {
      headers: { accept: "application/json" },
    });
  } catch (err) {
    throw new LiveProviderError(
      `Network error reaching Sportradar: ${err instanceof Error ? err.message : String(err)}`,
      "network"
    );
  }
  if (res.status === 429) throw new LiveProviderError("Sportradar rate limit reached.", "rate_limited");
  if (!res.ok) throw new LiveProviderError(`Sportradar API error (${res.status}).`, "network");
  const data = (await res.json()) as T;
  cache.set(cacheKey, { expires: Date.now() + ttlMs, data });
  return data;
}

/* eslint-disable @typescript-eslint/no-explicit-any -- external payloads are parsed defensively */
type Json = any;
/* eslint-enable @typescript-eslint/no-explicit-any */

function normalizeStatus(status: string | undefined): GameStatus {
  switch (status) {
    case "inprogress":
      return "live";
    case "halftime":
      return "halftime";
    case "closed":
    case "complete":
      return "final";
    default:
      return "scheduled";
  }
}

function normalizeGame(g: Json, week: number): NormalizedNFLGame {
  const situation = g?.situation ?? {};
  const possession: string | null = situation?.possession?.alias ?? null;
  const locAlias: string | null = situation?.location?.alias ?? null;
  const rawYardline: number | null = situation?.location?.yardline ?? null;
  // Normalize to yards from the possessing team's own goal line (0-100).
  let ballYardLine: number | null = null;
  if (possession && locAlias !== null && rawYardline !== null) {
    ballYardLine = locAlias === possession ? rawYardline : 100 - rawYardline;
  }
  const status = normalizeStatus(g?.status);
  return {
    id: `sr-${g.id}`,
    providerGameId: g.id,
    week,
    homeTeam: g?.home?.alias ?? "HOME",
    awayTeam: g?.away?.alias ?? "AWAY",
    homeScore: g?.scoring?.home_points ?? g?.home_points ?? 0,
    awayScore: g?.scoring?.away_points ?? g?.away_points ?? 0,
    status,
    quarter: g?.quarter ?? situation?.quarter ?? null,
    clock: situation?.clock ?? g?.clock ?? null,
    possessionTeam: status === "live" ? possession : null,
    ballYardLine: status === "live" ? ballYardLine : null,
    down: status === "live" ? situation?.down ?? null : null,
    distance: status === "live" ? situation?.yfd ?? null : null,
    redZone: status === "live" && ballYardLine !== null && ballYardLine >= 80,
    kickoffAt: g?.scheduled ?? new Date().toISOString(),
    driveSummary: null,
    updatedAt: new Date().toISOString(),
  };
}

interface PlayerMeta {
  name?: string;
  position?: string;
  team?: string;
}

/** Fold one team's statistics payload into per-player raw stat lines. */
function foldTeamStats(team: Json, out: Map<string, RawStatLine>, meta: Map<string, PlayerMeta>) {
  const alias: string | undefined = team?.alias;
  const touch = (id: string, p?: Json): RawStatLine => {
    const line = out.get(id) ?? {};
    out.set(id, line);
    if (!meta.has(id)) {
      meta.set(id, { name: p?.name, position: p?.position, team: alias });
    }
    return line;
  };
  for (const p of team?.passing?.players ?? []) {
    const line = touch(p.id, p);
    line.pass_att = p.attempts ?? 0;
    line.pass_cmp = p.completions ?? 0;
    line.pass_yd = p.yards ?? 0;
    line.pass_td = p.touchdowns ?? 0;
    line.pass_int = p.interceptions ?? 0;
  }
  for (const p of team?.rushing?.players ?? []) {
    const line = touch(p.id, p);
    line.rush_att = p.attempts ?? 0;
    line.rush_yd = p.yards ?? 0;
    line.rush_td = p.touchdowns ?? 0;
  }
  for (const p of team?.receiving?.players ?? []) {
    const line = touch(p.id, p);
    line.rec_tgt = p.targets ?? 0;
    line.rec = p.receptions ?? 0;
    line.rec_yd = p.yards ?? 0;
    line.rec_td = p.touchdowns ?? 0;
  }
  for (const p of team?.fumbles?.players ?? []) {
    const line = touch(p.id, p);
    line.fum = p.fumbles ?? 0;
    line.fum_lost = p.lost_fumbles ?? 0;
  }
  for (const p of team?.extra_points?.kicks?.players ?? []) {
    const line = touch(p.id, p);
    line.xpm = p.made ?? 0;
    line.xpmiss = (p.attempts ?? 0) - (p.made ?? 0);
  }
  for (const p of team?.field_goals?.players ?? []) {
    const line = touch(p.id, p);
    line.fgm = p.made ?? 0;
    line.fgmiss = (p.attempts ?? 0) - (p.made ?? 0);
  }
}

export class SportradarNFLProvider implements LiveSportsProvider {
  readonly id = "sportradar" as const;

  isConfigured(): boolean {
    return Boolean(process.env.SPORTRADAR_API_KEY);
  }

  async getCurrentWeek(): Promise<{ season: number; week: number }> {
    const sched = await srGet<Json>("/games/current_week/schedule.json", 10 * 60 * 1000);
    return {
      season: sched?.year ?? new Date().getFullYear(),
      week: sched?.week?.sequence ?? 1,
    };
  }

  async getSchedule(): Promise<NormalizedNFLGame[]> {
    const sched = await srGet<Json>("/games/current_week/schedule.json", 60 * 1000);
    const week = sched?.week?.sequence ?? 0;
    return (sched?.week?.games ?? []).map((g: Json) => normalizeGame(g, week));
  }

  async getLiveGames(): Promise<NormalizedNFLGame[]> {
    const games = await this.getSchedule();
    // Refresh live games from their boxscores for possession/field position.
    const live = games.filter((g) => g.status === "live" || g.status === "halftime");
    const detailed = await Promise.all(live.map((g) => this.getGame(g.id)));
    return detailed.filter((g): g is NormalizedNFLGame => g !== null);
  }

  async getGame(gameId: string): Promise<NormalizedNFLGame | null> {
    const providerId = gameId.replace(/^sr-/, "");
    try {
      const box = await srGet<Json>(`/games/${providerId}/boxscore.json`, 15 * 1000);
      return normalizeGame(box, box?.week?.sequence ?? 0);
    } catch (err) {
      if (err instanceof LiveProviderError && err.code === "rate_limited") throw err;
      return null;
    }
  }

  async getPlayerGameStats(gameIds: string[]): Promise<NormalizedPlayerGameStats[]> {
    const out: NormalizedPlayerGameStats[] = [];
    for (const gameId of gameIds) {
      const providerId = gameId.replace(/^sr-/, "");
      let statsPayload: Json;
      try {
        statsPayload = await srGet<Json>(`/games/${providerId}/statistics.json`, 20 * 1000);
      } catch {
        continue; // one bad game must not break the whole refresh
      }
      const lines = new Map<string, RawStatLine>();
      const meta = new Map<string, PlayerMeta>();
      foldTeamStats(statsPayload?.statistics?.home, lines, meta);
      foldTeamStats(statsPayload?.statistics?.away, lines, meta);
      const updatedAt = new Date().toISOString();
      for (const [sportradarPlayerId, stats] of lines) {
        const m = meta.get(sportradarPlayerId);
        out.push({
          // Provider-scoped id; the assembly layer maps it to a canonical
          // player via providerIds.sportradar (or the name fallback matcher).
          playerId: `sr-player-${sportradarPlayerId}`,
          gameId,
          stats,
          updatedAt,
          playerName: m?.name,
          position: m?.position,
          nflTeam: m?.team,
        });
      }
    }
    return out;
  }
}

export const sportradarProvider = new SportradarNFLProvider();
