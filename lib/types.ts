/**
 * Normalized domain types.
 *
 * Every data provider (fantasy or live-NFL, real or demo) normalizes into
 * these shapes. UI components and aggregation utilities only ever see these —
 * never raw Sleeper / Sportradar / Yahoo payloads.
 */

// ---------------------------------------------------------------------------
// Positions / basic enums
// ---------------------------------------------------------------------------

export type Position = "QB" | "RB" | "WR" | "TE" | "K" | "DST";

export type GameStatus = "scheduled" | "live" | "halftime" | "final";

export type MatchupStatus = "winning" | "losing" | "tossup" | "final";

export type ProviderId = "sleeper" | "yahoo" | "espn" | "demo";

export type LiveProviderId = "sportradar" | "sleeper" | "demo" | "none";

// ---------------------------------------------------------------------------
// Canonical player
// ---------------------------------------------------------------------------

/**
 * One canonical record per real NFL player, regardless of how many fantasy
 * leagues the user rosters him in. Provider IDs are used to join fantasy
 * ownership to live NFL stats.
 */
export interface NormalizedPlayer {
  id: string; // internal canonical id
  firstName: string;
  lastName: string;
  fullName: string;
  position: Position;
  nflTeam: string; // team abbreviation, e.g. "LAR"
  status: "active" | "injured" | "out" | "questionable" | "unknown";
  providerIds: {
    sleeper?: string;
    sportradar?: string;
    yahoo?: string;
    espn?: string;
    [key: string]: string | undefined;
  };
}

// ---------------------------------------------------------------------------
// Fantasy league structures
// ---------------------------------------------------------------------------

export type ScoringType = "ppr" | "half_ppr" | "standard" | "custom";

/**
 * League scoring settings, Sleeper-style keys. Unknown keys are preserved —
 * never silently discarded.
 */
export interface ScoringSettings {
  [statKey: string]: number;
}

export interface NormalizedLeague {
  id: string;
  provider: ProviderId;
  providerLeagueId: string;
  name: string;
  season: number;
  week: number;
  totalTeams: number;
  scoringType: ScoringType;
  scoringSettings: ScoringSettings;
  lastSyncedAt: string | null;
}

export interface NormalizedFantasyTeam {
  id: string;
  leagueId: string;
  providerRosterId: string;
  name: string;
  ownerName: string;
  isUserTeam: boolean;
  record?: { wins: number; losses: number; ties: number };
}

export interface NormalizedRosterSlot {
  id: string;
  fantasyTeamId: string;
  leagueId: string;
  playerId: string; // canonical player id
  slot: string; // QB / RB / WR / TE / FLEX / K / DST / BN
  isStarter: boolean;
  week: number;
  /**
   * Provider-computed fantasy points for this player in this league (e.g.
   * Sleeper's players_points). Used only when no live-stats provider is
   * configured; when raw stats exist, the local scoring engine wins.
   */
  providerPoints?: number;
}

export interface NormalizedMatchup {
  id: string;
  leagueId: string;
  week: number;
  userTeamId: string;
  opponentTeamId: string;
  /** Provider-reported live scores; may be recomputed locally from stats. */
  userScore: number;
  opponentScore: number;
  userProjected: number;
  opponentProjected: number;
  /** 0..1 — provider value if available, otherwise locally estimated. */
  winProbability: number | null;
  status: MatchupStatus;
}

// ---------------------------------------------------------------------------
// Live NFL structures
// ---------------------------------------------------------------------------

export interface NormalizedNFLGame {
  id: string;
  providerGameId: string;
  week: number;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  status: GameStatus;
  quarter: number | null; // 1-4, 5 = OT
  clock: string | null; // "8:41"
  possessionTeam: string | null;
  /** Yards from the possessing team's own goal line, 0-100. 80+ = red zone. */
  ballYardLine: number | null;
  down: number | null;
  distance: number | null;
  redZone: boolean;
  kickoffAt: string; // ISO
  /** Short drive description, e.g. "7 plays · 62 yds · 3:12" */
  driveSummary: string | null;
  updatedAt: string;
}

/** Raw football statistics for one player in one game. No fantasy math here. */
export interface NormalizedPlayerGameStats {
  playerId: string; // canonical player id (or provider-scoped id pre-mapping)
  gameId: string;
  stats: RawStatLine;
  updatedAt: string;
  /** Identity hints from the live provider, used by the conservative
   *  name+team+position fallback matcher when no direct external ID maps. */
  playerName?: string;
  position?: string;
  nflTeam?: string;
}

/**
 * Normalized raw stat line, Sleeper-compatible stat keys so scoring settings
 * apply directly.
 */
export interface RawStatLine {
  pass_yd?: number;
  pass_td?: number;
  pass_int?: number;
  pass_2pt?: number;
  pass_att?: number;
  pass_cmp?: number;
  rush_att?: number;
  rush_yd?: number;
  rush_td?: number;
  rush_2pt?: number;
  rec?: number;
  rec_tgt?: number;
  rec_yd?: number;
  rec_td?: number;
  rec_2pt?: number;
  fum?: number;
  fum_lost?: number;
  xpm?: number;
  xpmiss?: number;
  fgm?: number;
  fgm_0_19?: number;
  fgm_20_29?: number;
  fgm_30_39?: number;
  fgm_40_49?: number;
  fgm_50p?: number;
  fgmiss?: number;
  def_td?: number;
  sack?: number;
  int?: number;
  fum_rec?: number;
  safe?: number;
  pts_allow?: number;
  [key: string]: number | undefined;
}

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------

export type AlertType =
  | "touchdown"
  | "red_zone"
  | "big_play"
  | "game_start"
  | "game_final"
  | "player_milestone"
  | "fantasy_lead_change"
  | "stat_update";

export interface LeagueImpact {
  leagueId: string;
  leagueName: string;
  isStarter: boolean;
  points: number;
}

export interface PortfolioAlert {
  id: string;
  type: AlertType;
  at: string; // ISO timestamp
  headline: string; // "Marcus Reed — 18-yard receiving TD"
  detail: string | null;
  playerId: string | null;
  gameId: string | null;
  /** Which leagues does this matter to, and by how much? */
  leagueImpacts: LeagueImpact[];
  /** Sum of starting-lineup points impact. */
  portfolioImpact: number | null;
}

// ---------------------------------------------------------------------------
// Snapshot — the single payload the UI consumes
// ---------------------------------------------------------------------------

export interface FantasyConnectionInfo {
  provider: ProviderId;
  providerUsername: string | null;
  status: "connected" | "coming_soon" | "needs_config" | "disconnected";
  lastSyncedAt: string | null;
}

export interface PortfolioSnapshot {
  meta: {
    mode: "demo" | "live" | "mixed";
    fantasySource: ProviderId;
    liveSource: LiveProviderId;
    week: number;
    season: number;
    generatedAt: string;
    connections: FantasyConnectionInfo[];
  };
  leagues: NormalizedLeague[];
  fantasyTeams: NormalizedFantasyTeam[];
  players: NormalizedPlayer[];
  rosterSlots: NormalizedRosterSlot[];
  matchups: NormalizedMatchup[];
  games: NormalizedNFLGame[];
  playerStats: NormalizedPlayerGameStats[];
  alerts: PortfolioAlert[];
}

// ---------------------------------------------------------------------------
// Derived (client-side aggregation) types
// ---------------------------------------------------------------------------

/** One league's view of a canonical player the user rosters. */
export interface PlayerLeagueContext {
  leagueId: string;
  leagueName: string;
  scoringType: ScoringType;
  isStarter: boolean;
  slot: string;
  /** Fantasy points under THIS league's scoring settings. */
  points: number;
}

/** The fully-joined portfolio view of one canonical player. */
export interface PortfolioPlayer {
  player: NormalizedPlayer;
  game: NormalizedNFLGame | null;
  stats: RawStatLine | null;
  leagues: PlayerLeagueContext[];
  rosteredCount: number;
  starterCount: number;
  totalLeagues: number;
  rosterExposure: number; // 0..1
  starterExposure: number; // 0..1
  /** Sum of points across leagues where the user STARTS this player. */
  portfolioImpact: number;
  /** Sum of points across bench slots — shown separately, never mixed in. */
  benchPoints: number;
  /** Max single-league points (for display when not starting anywhere). */
  maxPoints: number;
  liveStatus: PlayerLiveStatus;
}

export type PlayerLiveStatus =
  | "live"
  | "red_zone"
  | "halftime"
  | "upcoming"
  | "final"
  | "no_game";

/** A game ranked by fantasy relevance to this user. */
export interface RankedGame {
  game: NormalizedNFLGame;
  players: PortfolioPlayer[];
  starterCount: number;
  benchCount: number;
  importanceScore: number;
  exposureLevel: "high" | "medium" | "low" | "none";
}

export interface MatchupView {
  matchup: NormalizedMatchup;
  league: NormalizedLeague;
  userTeam: NormalizedFantasyTeam;
  opponentTeam: NormalizedFantasyTeam;
  userRemaining: number; // starters not yet finished
  opponentRemaining: number;
}
