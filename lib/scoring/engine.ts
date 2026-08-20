import type { RawStatLine, ScoringSettings, ScoringType } from "@/lib/types";

/**
 * Fantasy scoring engine.
 *
 * Input: a raw NFL stat line + one league's scoring settings.
 * Output: fantasy points under that league's rules.
 *
 * Scoring settings use Sleeper-style keys (points per unit of the stat):
 *   pass_yd: 0.04   -> 0.04 pts per passing yard
 *   rec: 1          -> full PPR
 *   rec: 0.5        -> half PPR
 *
 * Any stat key present in both the stat line and the settings contributes.
 * Unknown settings keys are simply inert until a matching stat appears —
 * they are stored, never discarded.
 */

/** Stats that are counting inputs but never scored directly. */
const NON_SCORING_KEYS = new Set(["pass_att", "pass_cmp", "rec_tgt", "rush_att"]);

export function calculateFantasyPoints(
  stats: RawStatLine | null | undefined,
  settings: ScoringSettings
): number {
  if (!stats) return 0;
  let total = 0;
  for (const [key, value] of Object.entries(stats)) {
    if (value === undefined || value === 0) continue;
    if (NON_SCORING_KEYS.has(key)) continue;
    let perUnit: number | undefined = settings[key];
    // Distance-agnostic FG totals (some live providers report only a flat
    // "fgm") against leagues that score by distance bucket: fall back to the
    // most conservative bucket value rather than dropping the kicks entirely.
    if (perUnit === undefined && key === "fgm") {
      perUnit = flatFgFallback(settings);
    }
    if (perUnit === undefined || perUnit === 0) continue;
    total += value * perUnit;
  }
  return round1(total);
}

const FG_BUCKET_KEYS = ["fgm_0_19", "fgm_20_29", "fgm_30_39", "fgm_40_49", "fgm_50p"];

function flatFgFallback(settings: ScoringSettings): number | undefined {
  const bucketValues = FG_BUCKET_KEYS.map((k) => settings[k]).filter(
    (v): v is number => v !== undefined && v > 0
  );
  if (bucketValues.length === 0) return undefined;
  return Math.min(...bucketValues);
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// ---------------------------------------------------------------------------
// Common scoring presets (used by demo data and as Sleeper fallbacks)
// ---------------------------------------------------------------------------

const BASE_OFFENSE: ScoringSettings = {
  pass_yd: 0.04,
  pass_td: 4,
  pass_int: -2,
  pass_2pt: 2,
  rush_yd: 0.1,
  rush_td: 6,
  rush_2pt: 2,
  rec_yd: 0.1,
  rec_td: 6,
  rec_2pt: 2,
  fum_lost: -2,
  xpm: 1,
  fgm_0_19: 3,
  fgm_20_29: 3,
  fgm_30_39: 3,
  fgm_40_49: 4,
  fgm_50p: 5,
};

export const SCORING_PRESETS: Record<Exclude<ScoringType, "custom">, ScoringSettings> = {
  ppr: { ...BASE_OFFENSE, rec: 1 },
  half_ppr: { ...BASE_OFFENSE, rec: 0.5 },
  standard: { ...BASE_OFFENSE, rec: 0 },
};

/** Classify a raw settings object into a familiar label. */
export function classifyScoring(settings: ScoringSettings): ScoringType {
  const rec = settings.rec ?? 0;
  if (rec === 1) return "ppr";
  if (rec === 0.5) return "half_ppr";
  if (rec === 0) return "standard";
  return "custom";
}

export function scoringLabel(type: ScoringType): string {
  switch (type) {
    case "ppr":
      return "PPR";
    case "half_ppr":
      return "Half PPR";
    case "standard":
      return "Standard";
    case "custom":
      return "Custom";
  }
}
