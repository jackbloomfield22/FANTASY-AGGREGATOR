import type { NormalizedLeague, ScoringSettings } from "@/lib/types";
import { FantasyProvider, FantasyProviderError, FantasySyncResult, FantasyUser } from "./base";

/**
 * ESPN fantasy provider — interface and database support only.
 *
 * ESPN has no supported public fantasy API. We deliberately do NOT scrape or
 * rely on undocumented private endpoints. The provider surface exists so a
 * supported integration can drop in later; until then the UI shows
 * "Coming Soon".
 */
export class EspnFantasyProvider implements FantasyProvider {
  readonly id = "espn" as const;
  readonly displayName = "ESPN";

  isConfigured(): boolean {
    return false;
  }

  async getUser(): Promise<FantasyUser> {
    throw this.comingSoon();
  }

  async getLeagues(): Promise<NormalizedLeague[]> {
    throw this.comingSoon();
  }

  async getScoringSettings(): Promise<ScoringSettings> {
    throw this.comingSoon();
  }

  async syncUserFantasyData(): Promise<FantasySyncResult> {
    throw this.comingSoon();
  }

  private comingSoon(): FantasyProviderError {
    return new FantasyProviderError(
      "ESPN does not offer a supported public fantasy API yet — coming soon.",
      "not_configured"
    );
  }
}

export const espnProvider = new EspnFantasyProvider();
