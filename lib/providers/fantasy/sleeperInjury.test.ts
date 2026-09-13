import { describe, expect, it } from "vitest";
import { mapSleeperInjury } from "./sleeperInjury";

describe("mapSleeperInjury", () => {
  it("maps the weekly report designations", () => {
    expect(mapSleeperInjury("Active", "Questionable").injury).toBe("questionable");
    expect(mapSleeperInjury("Active", "Doubtful").injury).toBe("doubtful");
    expect(mapSleeperInjury("Active", "Out").injury).toBe("out");
    expect(mapSleeperInjury("Active", "IR")).toEqual({ injury: "ir", injuryLabel: "IR" });
    expect(mapSleeperInjury("Active", "Sus").injury).toBe("suspended");
  });

  it("falls back to the roster status for reserve lists", () => {
    expect(mapSleeperInjury("Injured Reserve", null).injury).toBe("ir");
    expect(mapSleeperInjury("Physically Unable to Perform", null)).toEqual({
      injury: "ir",
      injuryLabel: "PUP",
    });
    expect(mapSleeperInjury("Suspended", "").injury).toBe("suspended");
  });

  it("treats healthy/unknown values as available", () => {
    expect(mapSleeperInjury("Active", null).injury).toBeNull();
    expect(mapSleeperInjury("Active", "NA").injury).toBeNull();
    expect(mapSleeperInjury(undefined, undefined).injury).toBeNull();
  });
});
