import type {
  InjuryDesignation,
  PlayerLeagueContext,
  PortfolioPlayer,
  Position,
} from "@/lib/types";
import { round1 } from "@/lib/scoring/engine";

/**
 * Pre-kickoff lineup hygiene, derived purely from the aggregated portfolio:
 *   1. Injured starters — anyone in a starting lineup with a designation.
 *   2. Start/sit check  — bench players who project higher than the starter
 *      in a slot they're eligible for.
 */

/** Lower = worse. Sort by this to put the most urgent problems first. */
export const INJURY_SEVERITY: Record<InjuryDesignation, number> = {
  ir: 0,
  suspended: 1,
  out: 2,
  doubtful: 3,
  questionable: 4,
};

export const INJURY_LABEL: Record<InjuryDesignation, string> = {
  ir: "IR",
  suspended: "SUSPENDED",
  out: "OUT",
  doubtful: "DOUBTFUL",
  questionable: "QUESTIONABLE",
};

/** Designations that mean "this starter will not play" — drives the nav badge. */
export const UNAVAILABLE: ReadonlySet<InjuryDesignation> = new Set(["ir", "suspended", "out", "doubtful"]);

export interface InjuredStarter {
  leagueId: string;
  leagueName: string;
  slot: string;
  player: PortfolioPlayer;
  injury: InjuryDesignation;
}

/** Every (league, starting slot) occupied by a player carrying a designation. */
export function injuredStarters(players: PortfolioPlayer[]): InjuredStarter[] {
  const out: InjuredStarter[] = [];
  for (const p of players) {
    const injury = p.player.injury;
    if (!injury) continue;
    for (const ctx of p.leagues) {
      if (!ctx.isStarter) continue;
      out.push({ leagueId: ctx.leagueId, leagueName: ctx.leagueName, slot: ctx.slot, player: p, injury });
    }
  }
  return out.sort(
    (a, b) =>
      INJURY_SEVERITY[a.injury] - INJURY_SEVERITY[b.injury] ||
      a.leagueName.localeCompare(b.leagueName) ||
      a.player.player.fullName.localeCompare(b.player.player.fullName)
  );
}

/** Starters who will not play (Out / Doubtful / IR / Suspended) — the badge count. */
export function unavailableStarterCount(players: PortfolioPlayer[]): number {
  return injuredStarters(players).filter((s) => UNAVAILABLE.has(s.injury)).length;
}

// ---------------------------------------------------------------------------
// Start/sit efficiency
// ---------------------------------------------------------------------------

/** Which positions may fill each lineup slot (Sleeper slot names). */
export const SLOT_ELIGIBILITY: Record<string, Position[]> = {
  QB: ["QB"],
  RB: ["RB"],
  WR: ["WR"],
  TE: ["TE"],
  K: ["K"],
  DST: ["DST"],
  DEF: ["DST"],
  FLEX: ["RB", "WR", "TE"],
  WRRB_FLEX: ["RB", "WR"],
  REC_FLEX: ["WR", "TE"],
  SUPER_FLEX: ["QB", "RB", "WR", "TE"],
};

export interface EfficiencyFlag {
  leagueId: string;
  leagueName: string;
  slot: string;
  starter: PortfolioPlayer;
  starterProjected: number;
  bench: PortfolioPlayer;
  benchProjected: number;
  delta: number;
}

/** A player whose game is on or over can't be swapped anymore. */
function locked(p: PortfolioPlayer): boolean {
  return (
    p.liveStatus === "live" ||
    p.liveStatus === "red_zone" ||
    p.liveStatus === "halftime" ||
    p.liveStatus === "final" ||
    p.liveStatus === "played"
  );
}

function hasGameThisWeek(p: PortfolioPlayer, hasSchedule: boolean): boolean {
  if (hasSchedule) return p.game !== null;
  // No schedule feed: a projection line is the best available signal.
  return p.projectedPerLineup !== null;
}

/**
 * Flag slots where an eligible, healthy bench player with a game this week
 * projects higher than the starter. Each bench player is proposed at most
 * once per league (largest gain first) so suggestions are actionable.
 */
export function lineupEfficiency(
  players: PortfolioPlayer[],
  hasSchedule: boolean,
  minDelta = 0.05
): EfficiencyFlag[] {
  type Entry = { p: PortfolioPlayer; ctx: PlayerLeagueContext };
  const byLeague = new Map<string, { name: string; starters: Entry[]; bench: Entry[] }>();
  for (const p of players) {
    for (const ctx of p.leagues) {
      const league = byLeague.get(ctx.leagueId) ?? { name: ctx.leagueName, starters: [], bench: [] };
      (ctx.isStarter ? league.starters : league.bench).push({ p, ctx });
      byLeague.set(ctx.leagueId, league);
    }
  }

  const flags: EfficiencyFlag[] = [];
  for (const [leagueId, league] of byLeague) {
    const candidates: EfficiencyFlag[] = [];
    for (const s of league.starters) {
      const eligible = SLOT_ELIGIBILITY[s.ctx.slot];
      if (!eligible || locked(s.p)) continue;
      const starterProj = s.ctx.projectedPoints;
      if (starterProj === null) continue;
      for (const b of league.bench) {
        if (b.p.player.injury) continue;
        if (!eligible.includes(b.p.player.position)) continue;
        if (locked(b.p) || !hasGameThisWeek(b.p, hasSchedule)) continue;
        const benchProj = b.ctx.projectedPoints;
        if (benchProj === null) continue;
        const delta = round1(benchProj - starterProj);
        if (delta < minDelta) continue;
        candidates.push({
          leagueId,
          leagueName: league.name,
          slot: s.ctx.slot,
          starter: s.p,
          starterProjected: starterProj,
          bench: b.p,
          benchProjected: benchProj,
          delta,
        });
      }
    }
    candidates.sort((a, b) => b.delta - a.delta);
    const usedSlots = new Set<string>();
    const usedBench = new Set<string>();
    for (const c of candidates) {
      const slotKey = `${c.slot}:${c.starter.player.id}`;
      if (usedSlots.has(slotKey) || usedBench.has(c.bench.player.id)) continue;
      usedSlots.add(slotKey);
      usedBench.add(c.bench.player.id);
      flags.push(c);
    }
  }
  return flags.sort((a, b) => b.delta - a.delta || a.leagueName.localeCompare(b.leagueName));
}
