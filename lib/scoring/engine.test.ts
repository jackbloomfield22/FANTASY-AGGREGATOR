import { describe, expect, it } from "vitest";
import { calculateFantasyPoints, classifyScoring, SCORING_PRESETS } from "./engine";
import type { RawStatLine } from "@/lib/types";

const receiverLine: RawStatLine = {
  rec: 7,
  rec_tgt: 10,
  rec_yd: 94,
  rec_td: 1,
};

describe("calculateFantasyPoints", () => {
  it("scores a receiving line under PPR", () => {
    // 7 rec * 1 + 94 * 0.1 + 6 = 22.4
    expect(calculateFantasyPoints(receiverLine, SCORING_PRESETS.ppr)).toBe(22.4);
  });

  it("produces different totals for the same stat line under different scoring systems", () => {
    const ppr = calculateFantasyPoints(receiverLine, SCORING_PRESETS.ppr);
    const half = calculateFantasyPoints(receiverLine, SCORING_PRESETS.half_ppr);
    const std = calculateFantasyPoints(receiverLine, SCORING_PRESETS.standard);
    expect(ppr).toBe(22.4);
    expect(half).toBe(18.9);
    expect(std).toBe(15.4);
    expect(new Set([ppr, half, std]).size).toBe(3);
  });

  it("scores a QB line with negative interception points", () => {
    const qb: RawStatLine = {
      pass_yd: 285,
      pass_td: 3,
      pass_int: 2,
      rush_yd: 24,
      rush_td: 1,
    };
    // 285*0.04 + 12 - 4 + 2.4 + 6 = 27.8
    expect(calculateFantasyPoints(qb, SCORING_PRESETS.ppr)).toBe(27.8);
  });

  it("ignores stat keys the league does not score and non-scoring counters", () => {
    const line: RawStatLine = { rec_tgt: 12, pass_att: 30, rec: 4, rec_yd: 40 };
    expect(calculateFantasyPoints(line, SCORING_PRESETS.ppr)).toBe(8);
  });

  it("applies custom/unknown scoring keys when the stat exists", () => {
    const custom = { ...SCORING_PRESETS.ppr, bonus_rec_te: 0.5, rec_yd: 0.1 };
    const line: RawStatLine = { rec: 5, rec_yd: 50, bonus_rec_te: 5 };
    // 5 + 5 + 2.5 = 12.5
    expect(calculateFantasyPoints(line, custom)).toBe(12.5);
  });

  it("returns 0 for a missing stat line", () => {
    expect(calculateFantasyPoints(null, SCORING_PRESETS.ppr)).toBe(0);
  });

  it("handles fumbles and 2pt conversions", () => {
    const line: RawStatLine = { rush_yd: 60, rush_td: 1, rush_2pt: 1, fum_lost: 1 };
    // 6 + 6 + 2 - 2 = 12
    expect(calculateFantasyPoints(line, SCORING_PRESETS.standard)).toBe(12);
  });
});

describe("classifyScoring", () => {
  it("detects PPR / half PPR / standard / custom", () => {
    expect(classifyScoring({ rec: 1 })).toBe("ppr");
    expect(classifyScoring({ rec: 0.5 })).toBe("half_ppr");
    expect(classifyScoring({})).toBe("standard");
    expect(classifyScoring({ rec: 0.75 })).toBe("custom");
  });
});
