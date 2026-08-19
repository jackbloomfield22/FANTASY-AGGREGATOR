import { describe, expect, it } from "vitest";
import { exposureLevel, gameImportanceScore } from "./importance";

describe("gameImportanceScore", () => {
  it("ranks games with more active starters above bench-only games", () => {
    const manyStarters = gameImportanceScore({ starterCount: 5, benchCount: 2 });
    const benchOnly = gameImportanceScore({ starterCount: 0, benchCount: 6 });
    expect(manyStarters).toBeGreaterThan(benchOnly);
  });

  it("uses starters*2 + bench as the base formula", () => {
    expect(gameImportanceScore({ starterCount: 5, benchCount: 2 })).toBe(12);
    expect(gameImportanceScore({ starterCount: 0, benchCount: 3 })).toBe(3);
  });

  it("boosts live games for sorting without overwhelming exposure", () => {
    const liveSmall = gameImportanceScore({ starterCount: 1, benchCount: 0, isLive: true });
    const idleBig = gameImportanceScore({ starterCount: 3, benchCount: 0 });
    expect(liveSmall).toBeLessThan(idleBig);
    expect(liveSmall).toBeGreaterThan(gameImportanceScore({ starterCount: 1, benchCount: 0 }));
  });
});

describe("exposureLevel", () => {
  it("classifies exposure levels", () => {
    expect(exposureLevel(5, 2)).toBe("high");
    expect(exposureLevel(2, 0)).toBe("medium");
    expect(exposureLevel(0, 2)).toBe("low");
    expect(exposureLevel(0, 0)).toBe("none");
  });
});
