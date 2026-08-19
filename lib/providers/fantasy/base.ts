import type {
  NormalizedFantasyTeam,
  NormalizedLeague,
  NormalizedMatchup,
  NormalizedPlayer,
  NormalizedRosterSlot,
  ProviderId,
  ScoringSettings,
} from "@/lib/types";

/**
 * Fantasy account provider abstraction.
 *
 * A fantasy provider answers: which leagues does the user play in, which
 * players do they roster, who is starting, who is the weekly opponent, and
 * how does each league score. It never supplies live NFL game state — that
 * is the LiveSportsProvider's job (see ../live/base.ts).
 */

export interface FantasyUser {
  providerUserId: string;
  username: string;
  displayName: string;
}

/** Everything one sync pass produces, fully normalized. */
export interface FantasySyncResult {
  user: FantasyUser;
  leagues: NormalizedLeague[];
  teams: NormalizedFantasyTeam[];
  players: NormalizedPlayer[];
  rosterSlots: NormalizedRosterSlot[];
  matchups: NormalizedMatchup[];
  season: number;
  week: number;
  syncedAt: string;
  warnings: string[];
}

export class FantasyProviderError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "user_not_found"
      | "no_leagues"
      | "rate_limited"
      | "network"
      | "not_configured"
      | "unknown" = "unknown"
  ) {
    super(message);
    this.name = "FantasyProviderError";
  }
}

export interface FantasyProvider {
  readonly id: ProviderId;
  readonly displayName: string;
  /** Is this provider usable right now (credentials present, implemented)? */
  isConfigured(): boolean;

  getUser(identifier: string): Promise<FantasyUser>;
  getLeagues(providerUserId: string, season: number): Promise<NormalizedLeague[]>;
  getScoringSettings(providerLeagueId: string): Promise<ScoringSettings>;
  /**
   * Full sync: user -> leagues -> rosters -> starters -> matchups -> players.
   * Implementations must be idempotent (safe to call repeatedly).
   */
  syncUserFantasyData(identifier: string): Promise<FantasySyncResult>;
}
