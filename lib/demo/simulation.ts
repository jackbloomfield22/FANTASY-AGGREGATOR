import type {
  AlertType,
  NormalizedNFLGame,
  NormalizedPlayerGameStats,
  PortfolioAlert,
  PortfolioSnapshot,
  RawStatLine,
} from "@/lib/types";
import { calculateFantasyPoints, round1 } from "@/lib/scoring/engine";
import {
  DEMO_GAME_DEFS,
  DEMO_LEAGUES,
  DEMO_MATCHUPS_BASE,
  DEMO_PLAYERS,
  DEMO_ROSTER_SLOTS,
  DEMO_SEASON,
  DEMO_TEAMS,
  DEMO_WEEK,
  FEATURED_BASE_STATS,
  FEATURED_PLAYER_IDS,
  FULL_LINES,
  pid,
} from "./data";

/**
 * Deterministic demo live simulation.
 *
 * The demo world runs on a fixed-length repeating cycle. Game state and
 * player stats are a pure function of "seconds into the cycle", so two
 * requests at the same moment see identical data, polling shows believable
 * progression, and nothing is randomized per render.
 */

export const DEMO_CYCLE_SECONDS = 3000; // 50 minutes, then the script loops
const DEMO_EPOCH_MS = Date.UTC(2026, 0, 4, 18, 0, 0); // fixed anchor (a Sunday)

type GamePatch = Partial<
  Pick<
    NormalizedNFLGame,
    | "homeScore"
    | "awayScore"
    | "status"
    | "quarter"
    | "clock"
    | "possessionTeam"
    | "ballYardLine"
    | "down"
    | "distance"
    | "redZone"
    | "driveSummary"
  >
>;

interface DemoEvent {
  t: number; // seconds into the cycle
  gameId: string;
  patch?: GamePatch;
  /** Stat deltas for featured players (keyed by canonical player id). */
  deltas?: Record<string, RawStatLine>;
  alert?: {
    type: AlertType;
    headline: string;
    detail?: string;
    playerId?: string | null;
  };
}

// ---------------------------------------------------------------------------
// The script
// ---------------------------------------------------------------------------

const G1 = "g-lar-sea";
const G2 = "g-dal-phi";
const G3 = "g-buf-mia";
const G9 = "g-det-min";

const EVENTS: DemoEvent[] = [
  // ----- LAR @ SEA -----
  {
    t: 15,
    gameId: G1,
    alert: {
      type: "red_zone",
      headline: "Rams ball at the SEA 8",
      detail: "2nd & 6 · 4:22 left in the 3rd",
      playerId: pid("Marcus Reed"),
    },
  },
  {
    t: 120,
    gameId: G1,
    patch: {
      awayScore: 27,
      quarter: 3,
      clock: "2:55",
      possessionTeam: "SEA",
      ballYardLine: 25,
      down: 1,
      distance: 10,
      redZone: false,
      driveSummary: "9 plays · 72 yds · 5:37",
    },
    deltas: {
      [pid("Marcus Reed")]: { rec: 1, rec_tgt: 1, rec_yd: 8, rec_td: 1 },
      [pid("Shane Delaney")]: { pass_att: 1, pass_cmp: 1, pass_yd: 8, pass_td: 1 },
      [pid("Hugo Brandt")]: { xpm: 1 },
    },
    alert: {
      type: "touchdown",
      headline: "Marcus Reed — 8-yard receiving TD",
      detail: "LAR 27 — SEA 17",
      playerId: pid("Marcus Reed"),
    },
  },
  {
    t: 300,
    gameId: G1,
    patch: { clock: "0:41", ballYardLine: 58, down: 2, distance: 7, driveSummary: "6 plays · 33 yds · 2:14" },
  },
  {
    t: 420,
    gameId: G1,
    patch: {
      homeScore: 20,
      quarter: 4,
      clock: "13:55",
      possessionTeam: "LAR",
      ballYardLine: 25,
      down: 1,
      distance: 10,
      driveSummary: null,
    },
  },
  {
    t: 600,
    gameId: G1,
    patch: { clock: "12:04", ballYardLine: 48, down: 1, distance: 10, driveSummary: "4 plays · 23 yds · 1:51" },
    deltas: { [pid("Jaylen Brooks")]: { rush_att: 3, rush_yd: 21 } },
  },
  {
    t: 780,
    gameId: G1,
    patch: { clock: "10:36", ballYardLine: 70, down: 1, distance: 10, driveSummary: "5 plays · 45 yds · 3:19" },
    deltas: { [pid("Jaylen Brooks")]: { rush_att: 1, rush_yd: 24 } },
    alert: {
      type: "big_play",
      headline: "Jaylen Brooks — 24-yard run",
      detail: "LAR moving · ball at the SEA 30",
      playerId: pid("Jaylen Brooks"),
    },
  },
  {
    t: 900,
    gameId: G1,
    patch: {
      awayScore: 30,
      clock: "8:44",
      possessionTeam: "SEA",
      ballYardLine: 25,
      down: 1,
      distance: 10,
      driveSummary: null,
    },
    deltas: { [pid("Hugo Brandt")]: { fgm_40_49: 1 } },
  },
  {
    t: 1000,
    gameId: G1,
    patch: { clock: "7:30", ballYardLine: 52, down: 1, distance: 10 },
    deltas: { [pid("Jaylen Brooks")]: { rec: 1, rec_tgt: 1, rec_yd: 8 } },
  },
  {
    t: 1150,
    gameId: G1,
    patch: { clock: "6:10", ballYardLine: 88, down: 1, distance: 10, redZone: true, driveSummary: "7 plays · 63 yds · 2:34" },
    deltas: { [pid("Andre Bishop")]: { rec: 2, rec_tgt: 3, rec_yd: 26 } },
    alert: {
      type: "red_zone",
      headline: "Seahawks ball at the LAR 12",
      detail: "1st & 10 · 6:10 left in the 4th",
      playerId: pid("Andre Bishop"),
    },
  },
  {
    t: 1260,
    gameId: G1,
    patch: {
      homeScore: 27,
      clock: "5:02",
      possessionTeam: "LAR",
      ballYardLine: 25,
      down: 1,
      distance: 10,
      redZone: false,
      driveSummary: null,
    },
    deltas: { [pid("Andre Bishop")]: { rec: 1, rec_tgt: 1, rec_yd: 12, rec_td: 1 } },
    alert: {
      type: "touchdown",
      headline: "Andre Bishop — 12-yard receiving TD",
      detail: "LAR 30 — SEA 27",
      playerId: pid("Andre Bishop"),
    },
  },
  {
    t: 1500,
    gameId: G1,
    patch: { clock: "3:20", ballYardLine: 72, down: 1, distance: 10, driveSummary: "5 plays · 47 yds · 1:42" },
    deltas: {
      [pid("Marcus Reed")]: { rec: 1, rec_tgt: 1, rec_yd: 31 },
      [pid("Shane Delaney")]: { pass_att: 1, pass_cmp: 1, pass_yd: 31 },
    },
    alert: {
      type: "big_play",
      headline: "Marcus Reed — 31-yard reception",
      detail: "LAR into SEA territory",
      playerId: pid("Marcus Reed"),
    },
  },
  {
    t: 1520,
    gameId: G1,
    alert: {
      type: "player_milestone",
      headline: "Marcus Reed crosses 100 receiving yards",
      detail: "9 REC · 133 YDS · 1 TD",
      playerId: pid("Marcus Reed"),
    },
  },
  {
    t: 1700,
    gameId: G1,
    patch: { clock: "2:12", ballYardLine: 91, down: 2, distance: 4, redZone: true },
    alert: {
      type: "red_zone",
      headline: "Rams ball at the SEA 9",
      detail: "2nd & 4 · 2:12 left in the 4th",
      playerId: pid("Marcus Reed"),
    },
  },
  {
    t: 1850,
    gameId: G1,
    patch: {
      awayScore: 37,
      clock: "1:58",
      possessionTeam: "SEA",
      ballYardLine: 25,
      down: 1,
      distance: 10,
      redZone: false,
      driveSummary: null,
    },
    deltas: {
      [pid("Jaylen Brooks")]: { rush_att: 2, rush_yd: 9, rush_td: 1 },
      [pid("Hugo Brandt")]: { xpm: 1 },
    },
    alert: {
      type: "touchdown",
      headline: "Jaylen Brooks — 3-yard rushing TD",
      detail: "LAR 37 — SEA 27",
      playerId: pid("Jaylen Brooks"),
    },
  },
  {
    t: 2200,
    gameId: G1,
    patch: { clock: "0:49", possessionTeam: "SEA", ballYardLine: 47, down: 3, distance: 8 },
    deltas: { [pid("Shane Delaney")]: { pass_att: 11, pass_cmp: 7, pass_yd: 62 } },
  },
  {
    t: 2600,
    gameId: G1,
    patch: {
      status: "final",
      clock: "0:00",
      quarter: 4,
      possessionTeam: null,
      ballYardLine: null,
      down: null,
      distance: null,
      redZone: false,
      driveSummary: null,
    },
    alert: { type: "game_final", headline: "LAR 37 — SEA 27 · Final", playerId: pid("Marcus Reed") },
  },

  // ----- DAL @ PHI -----
  {
    t: 200,
    gameId: G2,
    patch: { clock: "7:12", ballYardLine: 62, down: 1, distance: 10, driveSummary: "6 plays · 37 yds · 3:25" },
    deltas: { [pid("Darius Cole")]: { rush_att: 1, rush_yd: 18 } },
  },
  {
    t: 350,
    gameId: G2,
    patch: { clock: "5:30", possessionTeam: "DAL", ballYardLine: 18, down: 1, distance: 10, driveSummary: null },
  },
  {
    t: 520,
    gameId: G2,
    patch: { clock: "3:12", ballYardLine: 45, down: 2, distance: 6, driveSummary: "5 plays · 27 yds · 2:18" },
    deltas: {
      [pid("Dee Calloway")]: { rec: 1, rec_tgt: 2, rec_yd: 16 },
      [pid("Grant Mercer")]: { pass_att: 3, pass_cmp: 2, pass_yd: 16 },
    },
  },
  {
    t: 650,
    gameId: G2,
    patch: { clock: "2:26", ballYardLine: 83, down: 1, distance: 10, redZone: true },
    deltas: {
      [pid("Dee Calloway")]: { rec: 1, rec_tgt: 1, rec_yd: 38 },
      [pid("Grant Mercer")]: { pass_att: 1, pass_cmp: 1, pass_yd: 38 },
    },
    alert: {
      type: "big_play",
      headline: "Dee Calloway — 38-yard reception",
      detail: "DAL ball at the PHI 17 · red zone",
      playerId: pid("Dee Calloway"),
    },
  },
  {
    t: 800,
    gameId: G2,
    patch: {
      awayScore: 24,
      clock: "1:05",
      possessionTeam: "PHI",
      ballYardLine: 25,
      down: 1,
      distance: 10,
      redZone: false,
      driveSummary: null,
    },
    deltas: {
      [pid("Grant Mercer")]: { rush_att: 2, rush_yd: 13, rush_td: 1 },
    },
    alert: {
      type: "touchdown",
      headline: "Grant Mercer — 6-yard rushing TD",
      detail: "DAL 24 — PHI 14",
      playerId: pid("Grant Mercer"),
    },
  },
  {
    t: 1000,
    gameId: G2,
    patch: { quarter: 4, clock: "14:10", ballYardLine: 55, down: 1, distance: 10, driveSummary: "6 plays · 30 yds · 1:55" },
    deltas: { [pid("Tyrell Watts")]: { rec: 2, rec_tgt: 3, rec_yd: 31 } },
  },
  {
    t: 1150,
    gameId: G2,
    patch: {
      homeScore: 21,
      clock: "12:48",
      possessionTeam: "DAL",
      ballYardLine: 25,
      down: 1,
      distance: 10,
      driveSummary: null,
    },
    deltas: {
      [pid("Beau Whitaker")]: { rec: 1, rec_tgt: 1, rec_yd: 11, rec_td: 1 },
      [pid("Felix Osei")]: { xpm: 1 },
    },
    alert: {
      type: "touchdown",
      headline: "Beau Whitaker — 11-yard receiving TD",
      detail: "DAL 24 — PHI 21",
      playerId: pid("Beau Whitaker"),
    },
  },
  {
    t: 1400,
    gameId: G2,
    patch: { clock: "9:15", ballYardLine: 70, down: 1, distance: 10, driveSummary: "7 plays · 45 yds · 3:33" },
    deltas: {
      [pid("Dee Calloway")]: { rec: 2, rec_tgt: 2, rec_yd: 3 },
      [pid("Grant Mercer")]: { pass_att: 9, pass_cmp: 6, pass_yd: 35 },
    },
  },
  {
    t: 1600,
    gameId: G2,
    patch: { awayScore: 27, clock: "7:02", possessionTeam: "PHI", ballYardLine: 25, down: 1, distance: 10, driveSummary: null },
  },
  {
    t: 1800,
    gameId: G2,
    patch: { clock: "4:44", ballYardLine: 61, down: 2, distance: 3, driveSummary: "8 plays · 36 yds · 2:18" },
    deltas: { [pid("Darius Cole")]: { rush_att: 3, rush_yd: 18, rec: 2, rec_tgt: 2, rec_yd: 15 } },
  },
  {
    t: 2000,
    gameId: G2,
    patch: { clock: "3:05", ballYardLine: 86, down: 1, distance: 10, redZone: true },
    alert: {
      type: "red_zone",
      headline: "Eagles ball at the DAL 14",
      detail: "1st & 10 · 3:05 left in the 4th",
      playerId: pid("Darius Cole"),
    },
  },
  {
    t: 2150,
    gameId: G2,
    patch: {
      homeScore: 28,
      clock: "2:20",
      possessionTeam: "DAL",
      ballYardLine: 25,
      down: 1,
      distance: 10,
      redZone: false,
      driveSummary: null,
    },
    deltas: {
      [pid("Darius Cole")]: { rush_att: 2, rush_yd: 7, rush_td: 1 },
      [pid("Felix Osei")]: { xpm: 1 },
    },
    alert: {
      type: "touchdown",
      headline: "Darius Cole — 5-yard rushing TD",
      detail: "PHI 28 — DAL 27",
      playerId: pid("Darius Cole"),
    },
  },
  {
    t: 2400,
    gameId: G2,
    patch: { clock: "1:12", ballYardLine: 51, down: 2, distance: 4 },
    deltas: { [pid("Grant Mercer")]: { pass_att: 5, pass_cmp: 3, pass_yd: 48 } },
    alert: {
      type: "fantasy_lead_change",
      headline: "Dynasty Empire — Priya edged ahead",
      detail: "Forever Rebuilding takes a narrow lead in your matchup",
      playerId: null,
    },
  },
  {
    t: 2800,
    gameId: G2,
    patch: {
      status: "final",
      clock: "0:00",
      quarter: 4,
      possessionTeam: null,
      ballYardLine: null,
      down: null,
      distance: null,
      redZone: false,
      driveSummary: null,
    },
    alert: { type: "game_final", headline: "PHI 28 — DAL 27 · Final", playerId: pid("Darius Cole") },
  },

  // ----- BUF @ MIA -----
  {
    t: 250,
    gameId: G3,
    patch: { clock: "2:11", ballYardLine: 78, down: 1, distance: 10, driveSummary: "8 plays · 53 yds · 3:54" },
    deltas: { [pid("Caleb Rourke")]: { pass_att: 2, pass_cmp: 2, pass_yd: 18 } },
  },
  {
    t: 500,
    gameId: G3,
    patch: { awayScore: 17, clock: "0:24", possessionTeam: "MIA", ballYardLine: 25, down: 1, distance: 10, driveSummary: null },
  },
  {
    t: 1000,
    gameId: G3,
    patch: { status: "halftime", clock: "0:00", quarter: 2, possessionTeam: null, ballYardLine: null, down: null, distance: null },
  },
  {
    t: 1300,
    gameId: G3,
    patch: { status: "live", quarter: 3, clock: "15:00", possessionTeam: "MIA", ballYardLine: 25, down: 1, distance: 10 },
  },
  {
    t: 1600,
    gameId: G3,
    patch: { clock: "9:30", ballYardLine: 70, down: 1, distance: 10, driveSummary: "9 plays · 45 yds · 5:12" },
    deltas: { [pid("Jamal Pryor")]: { rec: 2, rec_tgt: 2, rec_yd: 28 } },
  },
  {
    t: 1900,
    gameId: G3,
    patch: { clock: "6:47", ballYardLine: 85, down: 1, distance: 10, redZone: true },
    alert: {
      type: "red_zone",
      headline: "Dolphins ball at the BUF 15",
      detail: "1st & 10 · 6:47 left in the 3rd",
      playerId: pid("Jamal Pryor"),
    },
  },
  {
    t: 2050,
    gameId: G3,
    patch: {
      homeScore: 17,
      clock: "5:31",
      possessionTeam: "BUF",
      ballYardLine: 25,
      down: 1,
      distance: 10,
      redZone: false,
      driveSummary: null,
    },
    deltas: { [pid("Jamal Pryor")]: { rec: 1, rec_tgt: 1, rec_yd: 9, rec_td: 1 } },
    alert: {
      type: "touchdown",
      headline: "Jamal Pryor — 9-yard receiving TD",
      detail: "BUF 17 — MIA 17",
      playerId: pid("Jamal Pryor"),
    },
  },
  {
    t: 2300,
    gameId: G3,
    patch: { clock: "2:19", ballYardLine: 58, down: 2, distance: 5, driveSummary: "7 plays · 33 yds · 3:12" },
    deltas: {
      [pid("Trey Fontaine")]: { rush_att: 4, rush_yd: 26 },
      [pid("Caleb Rourke")]: { pass_att: 4, pass_cmp: 3, pass_yd: 41 },
    },
  },
  {
    t: 2600,
    gameId: G3,
    patch: { quarter: 4, clock: "14:22", ballYardLine: 88, down: 1, distance: 10, redZone: true },
    deltas: {
      [pid("Cody Lanier")]: { rec: 1, rec_tgt: 1, rec_yd: 44 },
      [pid("Caleb Rourke")]: { pass_att: 1, pass_cmp: 1, pass_yd: 44 },
    },
    alert: {
      type: "big_play",
      headline: "Cody Lanier — 44-yard reception",
      detail: "BUF ball at the MIA 12 · red zone",
      playerId: pid("Cody Lanier"),
    },
  },
  {
    t: 2850,
    gameId: G3,
    patch: {
      awayScore: 24,
      clock: "12:44",
      possessionTeam: "MIA",
      ballYardLine: 25,
      down: 1,
      distance: 10,
      redZone: false,
      driveSummary: null,
    },
    deltas: { [pid("Trey Fontaine")]: { rush_att: 2, rush_yd: 8, rush_td: 1 } },
    alert: {
      type: "touchdown",
      headline: "Trey Fontaine — 2-yard rushing TD",
      detail: "BUF 24 — MIA 17",
      playerId: pid("Trey Fontaine"),
    },
  },

  // ----- DET @ MIN (kicks off mid-cycle) -----
  {
    t: 2100,
    gameId: G9,
    patch: { status: "live", quarter: 1, clock: "12:33", possessionTeam: "DET", ballYardLine: 31, down: 1, distance: 10 },
    alert: { type: "game_start", headline: "DET @ MIN kicked off", detail: "Your Micah Boone is in this game", playerId: pid("Micah Boone") },
  },
  {
    t: 2400,
    gameId: G9,
    patch: { clock: "6:10", ballYardLine: 44, down: 2, distance: 7, driveSummary: "5 plays · 13 yds · 2:40" },
  },
  {
    t: 2700,
    gameId: G9,
    patch: { awayScore: 3, clock: "2:05", possessionTeam: "MIN", ballYardLine: 25, down: 1, distance: 10, driveSummary: null },
  },
];

// Sorted once; events are applied in order.
const SORTED_EVENTS = [...EVENTS].sort((a, b) => a.t - b.t);

/** When each scripted game changes lifecycle inside the cycle. */
const GAME_FINAL_AT: Record<string, number> = { [G1]: 2600, [G2]: 2800 };
const GAME_LIVE_AT: Record<string, number> = { [G9]: 2100 };

// ---------------------------------------------------------------------------
// Snapshot builder
// ---------------------------------------------------------------------------

/**
 * Offset that restarts the demo cycle at `nowMs` (used by "Reset Demo").
 * Stored in a cookie so the reset survives navigation and reloads.
 */
export function computeResetOffset(nowMs: number): number {
  const cycleMs = DEMO_CYCLE_SECONDS * 1000;
  return (((nowMs - DEMO_EPOCH_MS) % cycleMs) + cycleMs) % cycleMs;
}

export function demoElapsedSeconds(nowMs: number, epochOffsetMs = 0): number {
  const cycleMs = DEMO_CYCLE_SECONDS * 1000;
  const raw = (nowMs - DEMO_EPOCH_MS - epochOffsetMs) % cycleMs;
  return Math.floor(((raw + cycleMs) % cycleMs) / 1000);
}

/** Fraction of a full game played at `elapsed` (drives non-featured stat scaling). */
function gameProgress(gameId: string, elapsed: number): number {
  const def = DEMO_GAME_DEFS.find((d) => d.id === gameId)!;
  if (def.base.status === "final") return 1;
  if (def.base.status === "scheduled") {
    const liveAt = GAME_LIVE_AT[gameId];
    if (liveAt === undefined || elapsed < liveAt) return 0;
    return def.progressAtEnd * ((elapsed - liveAt) / (DEMO_CYCLE_SECONDS - liveAt));
  }
  const finalAt = GAME_FINAL_AT[gameId] ?? DEMO_CYCLE_SECONDS;
  const eff = Math.min(elapsed, finalAt);
  return def.progressAt0 + (def.progressAtEnd - def.progressAt0) * (eff / DEMO_CYCLE_SECONDS);
}

/** Scale a full-game stat line down to partial-game progress. */
export function scaleLine(line: RawStatLine, p: number): RawStatLine {
  if (p >= 1) return line;
  if (p <= 0) return {};
  const out: RawStatLine = {};
  for (const [k, v] of Object.entries(line)) {
    if (v === undefined) continue;
    // Touchdowns and made kicks "pop in" once enough of the game has passed;
    // continuous stats scale smoothly.
    const isDiscrete = k.includes("td") || k.startsWith("fgm") || k === "xpm" || k.includes("int") || k.includes("2pt");
    out[k] = isDiscrete ? Math.floor(v * p + 0.25) : Math.round(v * p);
  }
  return out;
}

function addLines(a: RawStatLine, b: RawStatLine): RawStatLine {
  const out: RawStatLine = { ...a };
  for (const [k, v] of Object.entries(b)) {
    if (v === undefined) continue;
    out[k] = (out[k] ?? 0) + v;
  }
  return out;
}

export function buildDemoSnapshot(nowMs: number, epochOffsetMs = 0): PortfolioSnapshot {
  const elapsed = demoElapsedSeconds(nowMs, epochOffsetMs);
  const cycleStartMs = nowMs - elapsed * 1000;
  const nowIso = new Date(nowMs).toISOString();

  // --- Games: base state + patches up to `elapsed` ---
  const games = new Map<string, NormalizedNFLGame>(
    DEMO_GAME_DEFS.map((def) => [
      def.id,
      {
        id: def.id,
        providerGameId: def.id,
        week: DEMO_WEEK,
        kickoffAt: new Date(cycleStartMs + def.kickoffOffsetMin * 60_000).toISOString(),
        updatedAt: nowIso,
        ...def.base,
      },
    ])
  );
  for (const ev of SORTED_EVENTS) {
    if (ev.t > elapsed) break;
    if (!ev.patch) continue;
    const g = games.get(ev.gameId);
    if (g) games.set(ev.gameId, { ...g, ...ev.patch });
  }

  // --- Stats ---
  const gameByTeam = new Map<string, NormalizedNFLGame>();
  for (const g of games.values()) {
    gameByTeam.set(g.homeTeam, g);
    gameByTeam.set(g.awayTeam, g);
  }

  const statLines = new Map<string, RawStatLine>();
  // Featured players: scripted base + event deltas.
  for (const [playerId, base] of Object.entries(FEATURED_BASE_STATS)) {
    let line = { ...base };
    for (const ev of SORTED_EVENTS) {
      if (ev.t > elapsed) break;
      const delta = ev.deltas?.[playerId];
      if (delta) line = addLines(line, delta);
    }
    statLines.set(playerId, line);
  }
  // Everyone else: full line scaled by game progress.
  for (const player of DEMO_PLAYERS) {
    if (FEATURED_PLAYER_IDS.has(player.id)) continue;
    const game = gameByTeam.get(player.nflTeam);
    if (!game) continue;
    const p = gameProgress(game.id, elapsed);
    if (p <= 0) continue;
    const line = scaleLine(FULL_LINES[player.id], p);
    if (Object.keys(line).length > 0) statLines.set(player.id, line);
  }

  const playerStats: NormalizedPlayerGameStats[] = [];
  for (const [playerId, stats] of statLines) {
    const player = DEMO_PLAYERS.find((pl) => pl.id === playerId)!;
    const game = gameByTeam.get(player.nflTeam);
    if (!game || game.status === "scheduled") continue;
    playerStats.push({ playerId, gameId: game.id, stats, updatedAt: nowIso });
  }

  // --- Alerts (most recent first) ---
  const userSlotsByPlayer = new Map<string, { leagueId: string; isStarter: boolean }[]>();
  for (const slot of DEMO_ROSTER_SLOTS) {
    if (!slot.fantasyTeamId.startsWith("t-user-")) continue;
    const list = userSlotsByPlayer.get(slot.playerId) ?? [];
    list.push({ leagueId: slot.leagueId, isStarter: slot.isStarter });
    userSlotsByPlayer.set(slot.playerId, list);
  }
  const leagueById = new Map(DEMO_LEAGUES.map((l) => [l.id, l]));

  const alerts: PortfolioAlert[] = [];
  for (const ev of SORTED_EVENTS) {
    if (ev.t > elapsed) break;
    if (!ev.alert) continue;
    const at = new Date(cycleStartMs + ev.t * 1000).toISOString();
    const playerId = ev.alert.playerId ?? null;
    const ownership = playerId ? userSlotsByPlayer.get(playerId) ?? [] : [];
    const leagueImpacts = ownership.map(({ leagueId, isStarter }) => {
      const league = leagueById.get(leagueId)!;
      const delta = playerId ? ev.deltas?.[playerId] : undefined;
      return {
        leagueId,
        leagueName: league.name,
        isStarter,
        points: delta ? calculateFantasyPoints(delta, league.scoringSettings) : 0,
      };
    });
    const portfolioImpact = leagueImpacts.some((li) => li.points !== 0)
      ? round1(leagueImpacts.filter((li) => li.isStarter).reduce((s, li) => s + li.points, 0))
      : null;
    alerts.push({
      id: `al-${ev.gameId}-${ev.t}`,
      type: ev.alert.type,
      at,
      headline: ev.alert.headline,
      detail: ev.alert.detail ?? null,
      playerId,
      gameId: ev.gameId,
      leagueImpacts,
      portfolioImpact,
    });
  }
  alerts.reverse();

  return {
    meta: {
      mode: "demo",
      fantasySource: "demo",
      liveSource: "demo",
      week: DEMO_WEEK,
      season: DEMO_SEASON,
      generatedAt: nowIso,
      connections: [
        { provider: "demo", providerUsername: "demo", status: "connected", lastSyncedAt: nowIso },
        { provider: "sleeper", providerUsername: null, status: "disconnected", lastSyncedAt: null },
        { provider: "yahoo", providerUsername: null, status: "needs_config", lastSyncedAt: null },
        { provider: "espn", providerUsername: null, status: "coming_soon", lastSyncedAt: null },
      ],
    },
    leagues: DEMO_LEAGUES,
    fantasyTeams: DEMO_TEAMS,
    players: DEMO_PLAYERS,
    rosterSlots: DEMO_ROSTER_SLOTS,
    matchups: DEMO_MATCHUPS_BASE,
    games: [...games.values()],
    playerStats,
    alerts: alerts.slice(0, 16),
  };
}
