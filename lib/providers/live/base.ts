import type {
  LiveProviderId,
  NormalizedNFLGame,
  NormalizedPlayerGameStats,
} from "@/lib/types";

/**
 * Live NFL data provider abstraction.
 *
 * A live provider supplies RAW football reality: schedule, scores, clocks,
 * possession, field position and raw player statistics. It never computes
 * fantasy points — that is the scoring engine's job, using each league's own
 * settings.
 */

export interface LiveSportsProvider {
  readonly id: LiveProviderId;
  isConfigured(): boolean;

  getCurrentWeek(): Promise<{ season: number; week: number }>;
  getSchedule(season: number, week: number): Promise<NormalizedNFLGame[]>;
  getLiveGames(): Promise<NormalizedNFLGame[]>;
  getGame(gameId: string): Promise<NormalizedNFLGame | null>;
  /**
   * Raw stats for every player in the given games — batched per game, never
   * one request per fantasy player.
   */
  getPlayerGameStats(gameIds: string[]): Promise<NormalizedPlayerGameStats[]>;
}

export class LiveProviderError extends Error {
  constructor(
    message: string,
    public readonly code: "not_configured" | "network" | "rate_limited" | "unknown" = "unknown"
  ) {
    super(message);
    this.name = "LiveProviderError";
  }
}
