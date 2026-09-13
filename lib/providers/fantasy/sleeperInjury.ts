import type { InjuryDesignation } from "@/lib/types";

/**
 * Map Sleeper's player-directory availability fields to one designation.
 * `injury_status` carries the weekly report (Questionable / Doubtful / Out /
 * IR / PUP / Sus / COV / NA); `status` carries the roster state ("Active",
 * "Injured Reserve", "Physically Unable to Perform", "Suspended", …).
 * Parsed defensively — these strings aren't in Sleeper's written docs.
 */
export function mapSleeperInjury(
  status: string | null | undefined,
  injuryStatus: string | null | undefined
): { injury: InjuryDesignation | null; injuryLabel: string | null } {
  const inj = String(injuryStatus ?? "").trim().toLowerCase();
  const st = String(status ?? "").trim().toLowerCase();

  if (inj === "ir" || st.includes("injured reserve")) return { injury: "ir", injuryLabel: "IR" };
  if (inj === "pup" || st.includes("physically unable")) return { injury: "ir", injuryLabel: "PUP" };
  if (inj === "nfi" || inj === "cov" || inj === "dnr" || st.startsWith("reserve")) {
    return { injury: "ir", injuryLabel: inj ? inj.toUpperCase() : "RES" };
  }
  if (inj === "sus" || inj === "suspended" || st.includes("suspend")) {
    return { injury: "suspended", injuryLabel: "SUSP" };
  }
  if (inj === "out") return { injury: "out", injuryLabel: "OUT" };
  if (inj === "doubtful") return { injury: "doubtful", injuryLabel: "D" };
  if (inj === "questionable") return { injury: "questionable", injuryLabel: "Q" };
  return { injury: null, injuryLabel: null };
}
