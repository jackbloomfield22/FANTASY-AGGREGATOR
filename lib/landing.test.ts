import { describe, expect, it } from "vitest";
import { defaultLandingPath, isGameDay } from "./landing";

describe("isGameDay (Eastern Time, in season)", () => {
  it("is true on Thursday, Sunday and Monday during the season", () => {
    expect(isGameDay(new Date("2026-09-13T17:00:00Z"))).toBe(true); // Sunday
    expect(isGameDay(new Date("2026-09-11T00:15:00Z"))).toBe(true); // Thu 8:15pm ET
    expect(isGameDay(new Date("2026-09-15T01:00:00Z"))).toBe(true); // Mon 9pm ET
  });

  it("is false on other weekdays and out of season", () => {
    expect(isGameDay(new Date("2026-09-16T17:00:00Z"))).toBe(false); // Wednesday
    expect(isGameDay(new Date("2026-06-14T17:00:00Z"))).toBe(false); // June Sunday
  });

  it("routes to the live window on game days", () => {
    expect(defaultLandingPath(new Date("2026-09-13T17:00:00Z"))).toBe("/live");
    expect(defaultLandingPath(new Date("2026-09-16T17:00:00Z"))).toBe("/dashboard");
  });
});
