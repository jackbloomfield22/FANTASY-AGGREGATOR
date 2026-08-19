import type { NormalizedLeague, ScoringSettings } from "@/lib/types";
import {
  DEMO_LEAGUES,
  DEMO_MATCHUPS_BASE,
  DEMO_PLAYERS,
  DEMO_ROSTER_SLOTS,
  DEMO_SEASON,
  DEMO_TEAMS,
  DEMO_WEEK,
} from "@/lib/demo/data";
import { FantasyProvider, FantasyProviderError, FantasySyncResult, FantasyUser } from "./base";

/**
 * Demo fantasy provider — serves the seeded fictional world through the same
 * interface as real providers, so the rest of the app cannot tell the
 * difference.
 */
export class DemoFantasyProvider implements FantasyProvider {
  readonly id = "demo" as const;
  readonly displayName = "Demo";

  isConfigured(): boolean {
    return true;
  }

  async getUser(): Promise<FantasyUser> {
    return { providerUserId: "demo-user", username: "demo", displayName: "Demo User" };
  }

  async getLeagues(): Promise<NormalizedLeague[]> {
    return DEMO_LEAGUES;
  }

  async getScoringSettings(providerLeagueId: string): Promise<ScoringSettings> {
    const league = DEMO_LEAGUES.find((l) => l.providerLeagueId === providerLeagueId);
    if (!league) throw new FantasyProviderError("Unknown demo league.", "unknown");
    return league.scoringSettings;
  }

  async syncUserFantasyData(): Promise<FantasySyncResult> {
    return {
      user: await this.getUser(),
      leagues: DEMO_LEAGUES,
      teams: DEMO_TEAMS,
      players: DEMO_PLAYERS,
      rosterSlots: DEMO_ROSTER_SLOTS,
      matchups: DEMO_MATCHUPS_BASE,
      season: DEMO_SEASON,
      week: DEMO_WEEK,
      syncedAt: new Date().toISOString(),
      warnings: [],
    };
  }
}

export const demoFantasyProvider = new DemoFantasyProvider();
