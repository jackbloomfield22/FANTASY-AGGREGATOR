import type {
  NormalizedFantasyTeam,
  NormalizedLeague,
  NormalizedMatchup,
  NormalizedNFLGame,
  NormalizedPlayer,
  NormalizedRosterSlot,
  Position,
  RawStatLine,
} from "@/lib/types";
import { calculateFantasyPoints, SCORING_PRESETS } from "@/lib/scoring/engine";

/**
 * Demo world definition.
 *
 * All player names are fictional. NFL team abbreviations are used only to
 * make game context legible. The world is deterministic: everything here is
 * computed once at module load from fixed seeds — no wall-clock randomness.
 */

export const DEMO_SEASON = 2025;
export const DEMO_WEEK = 8;

// ---------------------------------------------------------------------------
// Seeded PRNG (mulberry32) — deterministic stat generation
// ---------------------------------------------------------------------------

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function pid(name: string): string {
  return "p-" + name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

// ---------------------------------------------------------------------------
// NFL games — state at demo-cycle t = 0
// ---------------------------------------------------------------------------

export interface DemoGameDef {
  id: string;
  home: string;
  away: string;
  base: Omit<NormalizedNFLGame, "id" | "providerGameId" | "week" | "kickoffAt" | "updatedAt">;
  /** minutes relative to "now" for kickoff display */
  kickoffOffsetMin: number;
  /** progress fraction of a full game already played at t=0 (drives stat scaling) */
  progressAt0: number;
  /** progress fraction reached by the end of the demo cycle */
  progressAtEnd: number;
}

export const DEMO_GAME_DEFS: DemoGameDef[] = [
  {
    id: "g-lar-sea",
    home: "SEA",
    away: "LAR",
    kickoffOffsetMin: -125,
    progressAt0: 0.58,
    progressAtEnd: 1,
    base: {
      homeTeam: "SEA",
      awayTeam: "LAR",
      homeScore: 17,
      awayScore: 20,
      status: "live",
      quarter: 3,
      clock: "4:22",
      possessionTeam: "LAR",
      ballYardLine: 92, // LAR ball at the SEA 8
      down: 2,
      distance: 6,
      redZone: true,
      driveSummary: "8 plays · 64 yds · 4:10",
    },
  },
  {
    id: "g-dal-phi",
    home: "PHI",
    away: "DAL",
    kickoffOffsetMin: -118,
    progressAt0: 0.55,
    progressAtEnd: 1,
    base: {
      homeTeam: "PHI",
      awayTeam: "DAL",
      homeScore: 14,
      awayScore: 17,
      status: "live",
      quarter: 3,
      clock: "8:41",
      possessionTeam: "PHI",
      ballYardLine: 44,
      down: 1,
      distance: 10,
      redZone: false,
      driveSummary: "4 plays · 19 yds · 1:56",
    },
  },
  {
    id: "g-buf-mia",
    home: "MIA",
    away: "BUF",
    kickoffOffsetMin: -95,
    progressAt0: 0.38,
    progressAtEnd: 0.86,
    base: {
      homeTeam: "MIA",
      awayTeam: "BUF",
      homeScore: 10,
      awayScore: 14,
      status: "live",
      quarter: 2,
      clock: "6:05",
      possessionTeam: "BUF",
      ballYardLine: 61,
      down: 3,
      distance: 4,
      redZone: false,
      driveSummary: "6 plays · 36 yds · 2:44",
    },
  },
  {
    id: "g-kc-den",
    home: "DEN",
    away: "KC",
    kickoffOffsetMin: -300,
    progressAt0: 1,
    progressAtEnd: 1,
    base: {
      homeTeam: "DEN",
      awayTeam: "KC",
      homeScore: 20,
      awayScore: 27,
      status: "final",
      quarter: 4,
      clock: "0:00",
      possessionTeam: null,
      ballYardLine: null,
      down: null,
      distance: null,
      redZone: false,
      driveSummary: null,
    },
  },
  {
    id: "g-gb-chi",
    home: "CHI",
    away: "GB",
    kickoffOffsetMin: -305,
    progressAt0: 1,
    progressAtEnd: 1,
    base: {
      homeTeam: "CHI",
      awayTeam: "GB",
      homeScore: 31,
      awayScore: 24,
      status: "final",
      quarter: 4,
      clock: "0:00",
      possessionTeam: null,
      ballYardLine: null,
      down: null,
      distance: null,
      redZone: false,
      driveSummary: null,
    },
  },
  {
    id: "g-nyj-ne",
    home: "NE",
    away: "NYJ",
    kickoffOffsetMin: -310,
    progressAt0: 1,
    progressAtEnd: 1,
    base: {
      homeTeam: "NE",
      awayTeam: "NYJ",
      homeScore: 16,
      awayScore: 13,
      status: "final",
      quarter: 4,
      clock: "0:00",
      possessionTeam: null,
      ballYardLine: null,
      down: null,
      distance: null,
      redZone: false,
      driveSummary: null,
    },
  },
  {
    id: "g-sf-ari",
    home: "ARI",
    away: "SF",
    kickoffOffsetMin: 145,
    progressAt0: 0,
    progressAtEnd: 0,
    base: {
      homeTeam: "ARI",
      awayTeam: "SF",
      homeScore: 0,
      awayScore: 0,
      status: "scheduled",
      quarter: null,
      clock: null,
      possessionTeam: null,
      ballYardLine: null,
      down: null,
      distance: null,
      redZone: false,
      driveSummary: null,
    },
  },
  {
    id: "g-bal-cin",
    home: "CIN",
    away: "BAL",
    kickoffOffsetMin: 165,
    progressAt0: 0,
    progressAtEnd: 0,
    base: {
      homeTeam: "CIN",
      awayTeam: "BAL",
      homeScore: 0,
      awayScore: 0,
      status: "scheduled",
      quarter: null,
      clock: null,
      possessionTeam: null,
      ballYardLine: null,
      down: null,
      distance: null,
      redZone: false,
      driveSummary: null,
    },
  },
  {
    id: "g-det-min",
    home: "MIN",
    away: "DET",
    kickoffOffsetMin: 35, // kicks off during the demo cycle
    progressAt0: 0,
    progressAtEnd: 0.18,
    base: {
      homeTeam: "MIN",
      awayTeam: "DET",
      homeScore: 0,
      awayScore: 0,
      status: "scheduled",
      quarter: null,
      clock: null,
      possessionTeam: null,
      ballYardLine: null,
      down: null,
      distance: null,
      redZone: false,
      driveSummary: null,
    },
  },
];

// ---------------------------------------------------------------------------
// Leagues
// ---------------------------------------------------------------------------

export const DEMO_LEAGUES: NormalizedLeague[] = [
  {
    id: "lg-office",
    provider: "demo",
    providerLeagueId: "demo-office",
    name: "The Office League",
    season: DEMO_SEASON,
    week: DEMO_WEEK,
    totalTeams: 10,
    scoringType: "ppr",
    scoringSettings: SCORING_PRESETS.ppr,
    lastSyncedAt: null,
  },
  {
    id: "lg-dynasty",
    provider: "demo",
    providerLeagueId: "demo-dynasty",
    name: "Dynasty Empire",
    season: DEMO_SEASON,
    week: DEMO_WEEK,
    totalTeams: 12,
    scoringType: "half_ppr",
    scoringSettings: SCORING_PRESETS.half_ppr,
    lastSyncedAt: null,
  },
  {
    id: "lg-degens",
    provider: "demo",
    providerLeagueId: "demo-degens",
    name: "Sunday Degenerates",
    season: DEMO_SEASON,
    week: DEMO_WEEK,
    totalTeams: 12,
    scoringType: "custom",
    // 6-point passing TDs and a per-carry bonus — deliberately non-standard.
    scoringSettings: { ...SCORING_PRESETS.ppr, pass_td: 6, rush_att: 0.1 },
    lastSyncedAt: null,
  },
  {
    id: "lg-work",
    provider: "demo",
    providerLeagueId: "demo-work",
    name: "Work League",
    season: DEMO_SEASON,
    week: DEMO_WEEK,
    totalTeams: 10,
    scoringType: "standard",
    scoringSettings: SCORING_PRESETS.standard,
    lastSyncedAt: null,
  },
  {
    id: "lg-family",
    provider: "demo",
    providerLeagueId: "demo-family",
    name: "Family Feud FF",
    season: DEMO_SEASON,
    week: DEMO_WEEK,
    totalTeams: 8,
    scoringType: "ppr",
    scoringSettings: SCORING_PRESETS.ppr,
    lastSyncedAt: null,
  },
];

const USER_TEAM_NAMES: Record<string, string> = {
  "lg-office": "Jack Attack",
  "lg-dynasty": "Bloomfield Dynasty",
  "lg-degens": "Sunday Scaries",
  "lg-work": "Corner Office",
  "lg-family": "The Favorite Child",
};

const OPPONENT_TEAM_NAMES: Record<string, { name: string; owner: string }> = {
  "lg-office": { name: "Danny's Demolition", owner: "Danny" },
  "lg-dynasty": { name: "Forever Rebuilding", owner: "Priya" },
  "lg-degens": { name: "Tilted Ted", owner: "Ted" },
  "lg-work": { name: "Spreadsheet Slayers", owner: "Morgan" },
  "lg-family": { name: "Uncle Rico's Arm", owner: "Rico" },
};

const USER_RECORDS: Record<string, { wins: number; losses: number; ties: number }> = {
  "lg-office": { wins: 5, losses: 2, ties: 0 },
  "lg-dynasty": { wins: 3, losses: 4, ties: 0 },
  "lg-degens": { wins: 4, losses: 3, ties: 0 },
  "lg-work": { wins: 6, losses: 1, ties: 0 },
  "lg-family": { wins: 4, losses: 3, ties: 0 },
};

export const DEMO_TEAMS: NormalizedFantasyTeam[] = DEMO_LEAGUES.flatMap((league) => [
  {
    id: `t-user-${league.id}`,
    leagueId: league.id,
    providerRosterId: `${league.id}-1`,
    name: USER_TEAM_NAMES[league.id],
    ownerName: "You",
    isUserTeam: true,
    record: USER_RECORDS[league.id],
  },
  {
    id: `t-opp-${league.id}`,
    leagueId: league.id,
    providerRosterId: `${league.id}-2`,
    name: OPPONENT_TEAM_NAMES[league.id].name,
    ownerName: OPPONENT_TEAM_NAMES[league.id].owner,
    isUserTeam: false,
  },
]);

// ---------------------------------------------------------------------------
// User players — hand-authored so cross-league exposure tells a clear story
// ---------------------------------------------------------------------------

type Role = "S" | "B";

interface UserPlayerDef {
  name: string;
  pos: Position;
  team: string;
  /** leagueId -> S (starter) or B (bench) */
  leagues: Partial<Record<string, Role>>;
  /** slot override per league (defaults to position, BN for bench) */
  flexIn?: string[];
}

export const USER_PLAYER_DEFS: UserPlayerDef[] = [
  // --- Featured: LAR @ SEA (live, red zone) ---
  { name: "Marcus Reed", pos: "WR", team: "LAR", leagues: { "lg-office": "S", "lg-dynasty": "S", "lg-work": "B" } },
  { name: "Jaylen Brooks", pos: "RB", team: "LAR", leagues: { "lg-dynasty": "S", "lg-degens": "S" } },
  { name: "Shane Delaney", pos: "QB", team: "LAR", leagues: { "lg-dynasty": "S" } },
  { name: "Hugo Brandt", pos: "K", team: "LAR", leagues: { "lg-dynasty": "S" } },
  { name: "Andre Bishop", pos: "WR", team: "SEA", leagues: { "lg-dynasty": "S" }, flexIn: ["lg-dynasty"] },
  { name: "Omar Whitfield", pos: "RB", team: "SEA", leagues: { "lg-work": "S", "lg-family": "B" } },
  { name: "Silas Grange", pos: "TE", team: "SEA", leagues: { "lg-degens": "S" } },
  // --- Featured: DAL @ PHI (live) ---
  { name: "Dee Calloway", pos: "WR", team: "DAL", leagues: { "lg-office": "S", "lg-dynasty": "S", "lg-degens": "S" } },
  { name: "Grant Mercer", pos: "QB", team: "DAL", leagues: { "lg-office": "S", "lg-degens": "S" } },
  { name: "Victor Nunez", pos: "RB", team: "DAL", leagues: { "lg-family": "S" } },
  { name: "Darius Cole", pos: "RB", team: "PHI", leagues: { "lg-office": "S", "lg-work": "S", "lg-family": "S" }, flexIn: ["lg-family"] },
  { name: "Tyrell Watts", pos: "WR", team: "PHI", leagues: { "lg-degens": "S", "lg-family": "S" } },
  { name: "Beau Whitaker", pos: "TE", team: "PHI", leagues: { "lg-office": "S", "lg-dynasty": "S", "lg-family": "B" } },
  { name: "Felix Osei", pos: "K", team: "PHI", leagues: { "lg-office": "S" } },
  // --- BUF @ MIA (live) ---
  { name: "Caleb Rourke", pos: "QB", team: "BUF", leagues: { "lg-work": "S", "lg-family": "S" } },
  { name: "Trey Fontaine", pos: "RB", team: "BUF", leagues: { "lg-office": "S", "lg-dynasty": "B" } },
  { name: "Cody Lanier", pos: "WR", team: "BUF", leagues: { "lg-office": "S", "lg-family": "B" } },
  { name: "Jamal Pryor", pos: "WR", team: "MIA", leagues: { "lg-work": "S" } },
  // --- Final games ---
  { name: "Dominic Hale", pos: "QB", team: "KC", leagues: { "lg-dynasty": "B", "lg-degens": "B" } },
  { name: "Devon Sparks", pos: "WR", team: "KC", leagues: { "lg-dynasty": "S", "lg-degens": "B" }, flexIn: ["lg-dynasty"] },
  { name: "Nate Holloway", pos: "RB", team: "DEN", leagues: { "lg-degens": "S" } },
  { name: "Miles Corrigan", pos: "K", team: "DEN", leagues: { "lg-degens": "S" } },
  { name: "Eli Trask", pos: "WR", team: "GB", leagues: { "lg-work": "S" } },
  { name: "Marshawn Petty", pos: "RB", team: "CHI", leagues: { "lg-family": "S" } },
  { name: "Judah Voss", pos: "TE", team: "NE", leagues: { "lg-work": "S" } },
  // --- Upcoming games ---
  { name: "Roman Vance", pos: "WR", team: "SF", leagues: { "lg-office": "S", "lg-dynasty": "B" }, flexIn: ["lg-office"] },
  { name: "August Kane", pos: "QB", team: "SF", leagues: { "lg-office": "B" } },
  { name: "Toby Lockhart", pos: "K", team: "SF", leagues: { "lg-work": "S", "lg-family": "S" } },
  { name: "Isaiah Crowe", pos: "RB", team: "BAL", leagues: { "lg-office": "B", "lg-dynasty": "S" } },
  { name: "Kellen Ash", pos: "WR", team: "CIN", leagues: { "lg-degens": "S", "lg-family": "S" } },
  { name: "Micah Boone", pos: "WR", team: "DET", leagues: { "lg-work": "S" } },
  { name: "Lamont Frey", pos: "RB", team: "MIN", leagues: { "lg-degens": "B", "lg-work": "B" } },
  { name: "Cyrus Bell", pos: "TE", team: "MIN", leagues: { "lg-dynasty": "B", "lg-family": "S" } },
];

// ---------------------------------------------------------------------------
// Opponent player pool — generated deterministically
// ---------------------------------------------------------------------------

const OPP_DEFS: { name: string; pos: Position; team: string }[] = [
  { name: "Rex Calder", pos: "QB", team: "PHI" },
  { name: "Jonah Whit", pos: "QB", team: "SEA" },
  { name: "Amari Voss", pos: "QB", team: "MIA" },
  { name: "Cole Draper", pos: "QB", team: "GB" },
  { name: "Zeke Harmon", pos: "QB", team: "BAL" },
  { name: "Tobias Crane", pos: "RB", team: "SEA" },
  { name: "Malik Rowe", pos: "RB", team: "MIA" },
  { name: "Dante Ellison", pos: "RB", team: "KC" },
  { name: "Reggie Slate", pos: "RB", team: "GB" },
  { name: "Curtis Vale", pos: "RB", team: "NYJ" },
  { name: "Emmett Roy", pos: "RB", team: "SF" },
  { name: "Sterling Page", pos: "RB", team: "CIN" },
  { name: "Quincy Barr", pos: "RB", team: "DET" },
  { name: "Solomon Reyes", pos: "WR", team: "SEA" },
  { name: "Trent Mabry", pos: "WR", team: "DAL" },
  { name: "Kofi Ansah", pos: "WR", team: "PHI" },
  { name: "Larry Dunmore", pos: "WR", team: "BUF" },
  { name: "Xavier Pond", pos: "WR", team: "MIA" },
  { name: "Henry Stack", pos: "WR", team: "DEN" },
  { name: "Ivan Petrov", pos: "WR", team: "CHI" },
  { name: "Gideon Cross", pos: "WR", team: "NE" },
  { name: "Wesley Fort", pos: "WR", team: "ARI" },
  { name: "Neal Quimby", pos: "WR", team: "MIN" },
  { name: "Foster Lane", pos: "TE", team: "LAR" },
  { name: "Abram Steele", pos: "TE", team: "DAL" },
  { name: "Moses Clay", pos: "TE", team: "BUF" },
  { name: "Idris Fallon", pos: "TE", team: "DEN" },
  { name: "Paxton Hurst", pos: "TE", team: "ARI" },
  { name: "Boris Yandel", pos: "K", team: "DAL" },
  { name: "Cash Winslow", pos: "K", team: "MIA" },
  { name: "Dax Loman", pos: "K", team: "KC" },
];

/**
 * Opponent rosters, hand-assigned so each weekly matchup tells a distinct
 * story: comfortable win, narrow loss, toss-up, low-scoring win, and a
 * projection-driven loss to a team that mostly plays later. Opponents may
 * share players across leagues (realistic — different leagues, same NFL
 * player).
 */
const OPP_ROSTERS: Record<string, { starters: [string, string][]; bench: string[] }> = {
  "lg-office": {
    starters: [
      ["Rex Calder", "QB"],
      ["Tobias Crane", "RB"],
      ["Curtis Vale", "RB"],
      ["Trent Mabry", "WR"],
      ["Solomon Reyes", "WR"],
      ["Henry Stack", "FLEX"],
      ["Foster Lane", "TE"],
      ["Boris Yandel", "K"],
    ],
    bench: ["Reggie Slate", "Wesley Fort"],
  },
  "lg-dynasty": {
    starters: [
      ["Jonah Whit", "QB"],
      ["Dante Ellison", "RB"],
      ["Reggie Slate", "RB"],
      ["Kofi Ansah", "WR"],
      ["Larry Dunmore", "WR"],
      ["Ivan Petrov", "FLEX"],
      ["Abram Steele", "TE"],
      ["Cash Winslow", "K"],
    ],
    bench: ["Emmett Roy", "Xavier Pond"],
  },
  "lg-degens": {
    starters: [
      ["Amari Voss", "QB"],
      ["Emmett Roy", "RB"],
      ["Malik Rowe", "RB"],
      ["Xavier Pond", "WR"],
      ["Henry Stack", "WR"],
      ["Gideon Cross", "FLEX"],
      ["Moses Clay", "TE"],
      ["Dax Loman", "K"],
    ],
    bench: ["Quincy Barr", "Trent Mabry"],
  },
  "lg-work": {
    starters: [
      ["Cole Draper", "QB"],
      ["Sterling Page", "RB"],
      ["Quincy Barr", "RB"],
      ["Neal Quimby", "WR"],
      ["Trent Mabry", "WR"],
      ["Curtis Vale", "FLEX"],
      ["Idris Fallon", "TE"],
      ["Boris Yandel", "K"],
    ],
    bench: ["Malik Rowe", "Kofi Ansah"],
  },
  "lg-family": {
    starters: [
      ["Zeke Harmon", "QB"],
      ["Tobias Crane", "RB"],
      ["Sterling Page", "RB"],
      ["Wesley Fort", "WR"],
      ["Neal Quimby", "WR"],
      ["Xavier Pond", "FLEX"],
      ["Paxton Hurst", "TE"],
      ["Cash Winslow", "K"],
    ],
    bench: ["Curtis Vale", "Gideon Cross"],
  },
};

/** Hand-tuned full-game lines for opponent players (balances the matchups). */
const OPP_FULL_LINES: Record<string, RawStatLine> = {
  [pid("Rex Calder")]: { pass_att: 34, pass_cmp: 23, pass_yd: 300, pass_td: 2, pass_int: 1, rush_att: 3, rush_yd: 12 },
  [pid("Jonah Whit")]: { pass_att: 38, pass_cmp: 26, pass_yd: 330, pass_td: 3, pass_int: 1, rush_att: 2, rush_yd: 8 },
  [pid("Amari Voss")]: { pass_att: 36, pass_cmp: 25, pass_yd: 310, pass_td: 3, rush_att: 4, rush_yd: 22 },
  [pid("Cole Draper")]: { pass_att: 33, pass_cmp: 21, pass_yd: 260, pass_td: 2, pass_int: 1 },
  [pid("Zeke Harmon")]: { pass_att: 35, pass_cmp: 24, pass_yd: 290, pass_td: 2, pass_int: 1, rush_att: 5, rush_yd: 30 },
  [pid("Tobias Crane")]: { rush_att: 16, rush_yd: 90, rush_td: 1, rec: 3, rec_tgt: 4, rec_yd: 25 },
  [pid("Curtis Vale")]: { rush_att: 15, rush_yd: 85, rec: 2, rec_tgt: 3, rec_yd: 15 },
  [pid("Dante Ellison")]: { rush_att: 22, rush_yd: 165, rush_td: 2, rec: 4, rec_tgt: 4, rec_yd: 40 },
  [pid("Reggie Slate")]: { rush_att: 14, rush_yd: 95, rush_td: 1, rec: 2, rec_tgt: 2, rec_yd: 12 },
  [pid("Malik Rowe")]: { rush_att: 14, rush_yd: 100, rush_td: 1, rec: 4, rec_tgt: 5, rec_yd: 35 },
  [pid("Emmett Roy")]: { rush_att: 17, rush_yd: 105, rush_td: 1, rec: 3, rec_tgt: 3, rec_yd: 20 },
  [pid("Sterling Page")]: { rush_att: 17, rush_yd: 95, rush_td: 1, rec: 4, rec_tgt: 5, rec_yd: 30 },
  [pid("Quincy Barr")]: { rush_att: 13, rush_yd: 70, rec: 2, rec_tgt: 3, rec_yd: 18 },
  [pid("Solomon Reyes")]: { rec_tgt: 12, rec: 9, rec_yd: 140, rec_td: 1 },
  [pid("Trent Mabry")]: { rec_tgt: 8, rec: 6, rec_yd: 85, rec_td: 1 },
  [pid("Kofi Ansah")]: { rec_tgt: 11, rec: 9, rec_yd: 130, rec_td: 1 },
  [pid("Larry Dunmore")]: { rec_tgt: 9, rec: 7, rec_yd: 95, rec_td: 1 },
  [pid("Xavier Pond")]: { rec_tgt: 8, rec: 6, rec_yd: 75 },
  [pid("Henry Stack")]: { rec_tgt: 7, rec: 5, rec_yd: 60 },
  [pid("Ivan Petrov")]: { rec_tgt: 12, rec: 10, rec_yd: 150, rec_td: 2 },
  [pid("Gideon Cross")]: { rec_tgt: 7, rec: 5, rec_yd: 70 },
  [pid("Wesley Fort")]: { rec_tgt: 9, rec: 7, rec_yd: 100, rec_td: 1 },
  [pid("Neal Quimby")]: { rec_tgt: 7, rec: 6, rec_yd: 80 },
  [pid("Foster Lane")]: { rec_tgt: 6, rec: 5, rec_yd: 50, rec_td: 1 },
  [pid("Abram Steele")]: { rec_tgt: 7, rec: 6, rec_yd: 65, rec_td: 1 },
  [pid("Moses Clay")]: { rec_tgt: 5, rec: 4, rec_yd: 40 },
  [pid("Idris Fallon")]: { rec_tgt: 5, rec: 4, rec_yd: 45 },
  [pid("Paxton Hurst")]: { rec_tgt: 6, rec: 5, rec_yd: 55, rec_td: 1 },
  [pid("Boris Yandel")]: { xpm: 3, fgm_30_39: 1, fgm_40_49: 1 },
  [pid("Cash Winslow")]: { xpm: 2, fgm_20_29: 1, fgm_40_49: 1 },
  [pid("Dax Loman")]: { xpm: 3, fgm_30_39: 2, fgm_50p: 1 },
};

export const DEMO_PLAYERS: NormalizedPlayer[] = [
  ...USER_PLAYER_DEFS.map((d) => defToPlayer(d.name, d.pos, d.team)),
  ...OPP_DEFS.map((d) => defToPlayer(d.name, d.pos, d.team)),
];

function defToPlayer(name: string, pos: Position, team: string): NormalizedPlayer {
  const [first, ...rest] = name.split(" ");
  return {
    id: pid(name),
    firstName: first,
    lastName: rest.join(" "),
    fullName: name,
    position: pos,
    nflTeam: team,
    status: "active",
    providerIds: { demo: pid(name) },
  };
}

// ---------------------------------------------------------------------------
// Roster slots
// ---------------------------------------------------------------------------

export const DEMO_ROSTER_SLOTS: NormalizedRosterSlot[] = buildRosterSlots();

function buildRosterSlots(): NormalizedRosterSlot[] {
  const slots: NormalizedRosterSlot[] = [];
  let n = 0;
  const add = (teamId: string, leagueId: string, playerId: string, slot: string, isStarter: boolean) => {
    slots.push({
      id: `rs-${++n}`,
      fantasyTeamId: teamId,
      leagueId,
      playerId,
      slot,
      isStarter,
      week: DEMO_WEEK,
    });
  };

  // User rosters from the hand-authored table.
  for (const def of USER_PLAYER_DEFS) {
    for (const [leagueId, role] of Object.entries(def.leagues)) {
      const isStarter = role === "S";
      const slot = !isStarter ? "BN" : def.flexIn?.includes(leagueId) ? "FLEX" : def.pos;
      add(`t-user-${leagueId}`, leagueId, pid(def.name), slot, isStarter);
    }
  }

  // Opponent rosters from the hand-assigned tables.
  for (const league of DEMO_LEAGUES) {
    const teamId = `t-opp-${league.id}`;
    const roster = OPP_ROSTERS[league.id];
    for (const [name, slot] of roster.starters) {
      add(teamId, league.id, pid(name), slot, true);
    }
    for (const name of roster.bench) {
      add(teamId, league.id, pid(name), "BN", false);
    }
  }

  return slots;
}

// ---------------------------------------------------------------------------
// Full-game stat lines (used for projections + progress scaling)
// ---------------------------------------------------------------------------

/** Hand-tuned full lines for featured players (their live stats are scripted). */
const FEATURED_FULL_LINES: Record<string, RawStatLine> = {
  [pid("Marcus Reed")]: { rec_tgt: 12, rec: 9, rec_yd: 133, rec_td: 2 },
  [pid("Jaylen Brooks")]: { rush_att: 18, rush_yd: 115, rush_td: 1, rec: 3, rec_tgt: 4, rec_yd: 22 },
  [pid("Shane Delaney")]: { pass_att: 34, pass_cmp: 24, pass_yd: 289, pass_td: 3, pass_int: 1, rush_yd: 12 },
  [pid("Hugo Brandt")]: { xpm: 4, fgm_40_49: 1 },
  [pid("Andre Bishop")]: { rec_tgt: 10, rec: 7, rec_yd: 96, rec_td: 1 },
  [pid("Dee Calloway")]: { rec_tgt: 13, rec: 10, rec_yd: 138, rec_td: 1 },
  [pid("Grant Mercer")]: { pass_att: 33, pass_cmp: 23, pass_yd: 253, pass_td: 1, pass_int: 1, rush_att: 7, rush_yd: 30, rush_td: 1 },
  [pid("Darius Cole")]: { rush_att: 17, rush_yd: 100, rush_td: 1, rec: 4, rec_tgt: 5, rec_yd: 31 },
  [pid("Tyrell Watts")]: { rec_tgt: 8, rec: 5, rec_yd: 72 },
  [pid("Beau Whitaker")]: { rec_tgt: 6, rec: 4, rec_yd: 39, rec_td: 1 },
  [pid("Felix Osei")]: { xpm: 4 },
  [pid("Caleb Rourke")]: { pass_att: 30, pass_cmp: 21, pass_yd: 305, pass_td: 2, rush_att: 4, rush_yd: 18 },
  [pid("Trey Fontaine")]: { rush_att: 16, rush_yd: 82, rush_td: 1, rec: 2, rec_tgt: 2, rec_yd: 12 },
  [pid("Cody Lanier")]: { rec_tgt: 8, rec: 5, rec_yd: 96, rec_td: 1 },
  [pid("Jamal Pryor")]: { rec_tgt: 7, rec: 6, rec_yd: 71, rec_td: 1 },
};

/** Base stats at t=0 for players in live games (featured, hand-tuned). */
export const FEATURED_BASE_STATS: Record<string, RawStatLine> = {
  [pid("Marcus Reed")]: { rec_tgt: 9, rec: 7, rec_yd: 94, rec_td: 1 },
  [pid("Jaylen Brooks")]: { rush_att: 12, rush_yd: 61, rec: 2, rec_tgt: 3, rec_yd: 14 },
  [pid("Shane Delaney")]: { pass_att: 21, pass_cmp: 15, pass_yd: 188, pass_td: 2, pass_int: 1, rush_yd: 8 },
  [pid("Hugo Brandt")]: { xpm: 2 },
  [pid("Andre Bishop")]: { rec_tgt: 6, rec: 4, rec_yd: 58 },
  [pid("Dee Calloway")]: { rec_tgt: 8, rec: 6, rec_yd: 81, rec_td: 1 },
  [pid("Grant Mercer")]: { pass_att: 19, pass_cmp: 13, pass_yd: 164, pass_td: 1, pass_int: 1, rush_att: 3, rush_yd: 17 },
  [pid("Darius Cole")]: { rush_att: 11, rush_yd: 57, rec: 2, rec_tgt: 3, rec_yd: 16 },
  [pid("Tyrell Watts")]: { rec_tgt: 5, rec: 3, rec_yd: 41 },
  [pid("Beau Whitaker")]: { rec_tgt: 4, rec: 3, rec_yd: 28 },
  [pid("Felix Osei")]: { xpm: 2 },
  [pid("Caleb Rourke")]: { pass_att: 14, pass_cmp: 10, pass_yd: 128, pass_td: 1, rush_att: 2, rush_yd: 11 },
  [pid("Trey Fontaine")]: { rush_att: 7, rush_yd: 34, rec: 1, rec_tgt: 1, rec_yd: 6 },
  [pid("Cody Lanier")]: { rec_tgt: 4, rec: 3, rec_yd: 39, rec_td: 1 },
  [pid("Jamal Pryor")]: { rec_tgt: 3, rec: 2, rec_yd: 21 },
};

export const FEATURED_PLAYER_IDS = new Set(Object.keys(FEATURED_BASE_STATS));

/** Generate a plausible full-game line for a non-featured player. */
export function generatedFullLine(playerId: string, pos: Position): RawStatLine {
  const rand = mulberry32(hashString(playerId));
  const between = (lo: number, hi: number) => Math.round(lo + rand() * (hi - lo));
  const chance = (p: number) => (rand() < p ? 1 : 0);
  switch (pos) {
    case "QB": {
      const att = between(26, 40);
      return {
        pass_att: att,
        pass_cmp: Math.round(att * (0.58 + rand() * 0.14)),
        pass_yd: between(185, 330),
        pass_td: between(0, 3),
        pass_int: chance(0.5) ? between(1, 2) : 0,
        rush_att: between(1, 6),
        rush_yd: between(0, 38),
        rush_td: chance(0.15),
      };
    }
    case "RB": {
      return {
        rush_att: between(9, 22),
        rush_yd: between(32, 118),
        rush_td: chance(0.45),
        rec_tgt: between(1, 6),
        rec: between(1, 5),
        rec_yd: between(4, 44),
        rec_td: chance(0.1),
      };
    }
    case "WR": {
      const tgt = between(4, 12);
      return {
        rec_tgt: tgt,
        rec: Math.max(1, Math.round(tgt * (0.5 + rand() * 0.3))),
        rec_yd: between(24, 128),
        rec_td: chance(0.4),
      };
    }
    case "TE": {
      const tgt = between(3, 9);
      return {
        rec_tgt: tgt,
        rec: Math.max(1, Math.round(tgt * (0.55 + rand() * 0.25))),
        rec_yd: between(18, 78),
        rec_td: chance(0.3),
      };
    }
    case "K": {
      return {
        xpm: between(1, 4),
        fgm_20_29: chance(0.5),
        fgm_30_39: chance(0.6),
        fgm_40_49: chance(0.45),
        fgm_50p: chance(0.15),
      };
    }
    case "DST":
      return { sack: between(1, 4), int: chance(0.6), fum_rec: chance(0.4), def_td: chance(0.1), pts_allow: between(10, 27) };
  }
}

export const FULL_LINES: Record<string, RawStatLine> = Object.fromEntries(
  DEMO_PLAYERS.map((p) => [
    p.id,
    FEATURED_FULL_LINES[p.id] ?? OPP_FULL_LINES[p.id] ?? generatedFullLine(p.id, p.position),
  ])
);

// ---------------------------------------------------------------------------
// Matchups (projections computed from full lines under league scoring)
// ---------------------------------------------------------------------------

export const DEMO_MATCHUPS_BASE: NormalizedMatchup[] = DEMO_LEAGUES.map((league) => {
  const project = (teamId: string): number => {
    const starters = DEMO_ROSTER_SLOTS.filter((s) => s.fantasyTeamId === teamId && s.isStarter);
    const total = starters.reduce(
      (sum, s) => sum + calculateFantasyPoints(FULL_LINES[s.playerId], league.scoringSettings),
      0
    );
    return Math.round(total * 10) / 10;
  };
  return {
    id: `m-${league.id}`,
    leagueId: league.id,
    week: DEMO_WEEK,
    userTeamId: `t-user-${league.id}`,
    opponentTeamId: `t-opp-${league.id}`,
    userScore: 0,
    opponentScore: 0,
    userProjected: project(`t-user-${league.id}`),
    opponentProjected: project(`t-opp-${league.id}`),
    winProbability: null, // estimated locally by the aggregation layer
    status: "tossup",
  };
});

export { mulberry32, hashString };
