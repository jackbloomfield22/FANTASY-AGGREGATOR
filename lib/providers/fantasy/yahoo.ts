import type { NormalizedLeague, ScoringSettings } from "@/lib/types";
import { FantasyProvider, FantasyProviderError, FantasySyncResult, FantasyUser } from "./base";

/**
 * Yahoo Fantasy Sports provider.
 *
 * Yahoo requires a registered OAuth 2.0 application. Set:
 *   YAHOO_CLIENT_ID
 *   YAHOO_CLIENT_SECRET
 * in the server environment to enable the connection flow.
 *
 * Without credentials, this provider reports itself unconfigured and the UI
 * disables the Yahoo card gracefully — no fake OAuth, no scraping.
 *
 * Implementation plan (when credentials exist):
 *   1. Redirect to https://api.login.yahoo.com/oauth2/request_auth
 *   2. Exchange the code at https://api.login.yahoo.com/oauth2/get_token
 *   3. Query the Fantasy Sports API (fantasysports.yahooapis.com) for
 *      users;use_login=1/games;game_keys=nfl/leagues, then teams, rosters,
 *      matchups and league settings.
 *   4. Normalize into the same internal types Sleeper uses.
 */
export class YahooFantasyProvider implements FantasyProvider {
  readonly id = "yahoo" as const;
  readonly displayName = "Yahoo";

  isConfigured(): boolean {
    return Boolean(process.env.YAHOO_CLIENT_ID && process.env.YAHOO_CLIENT_SECRET);
  }

  /** OAuth authorization URL — only meaningful when configured. */
  getAuthorizationUrl(redirectUri: string, state: string): string {
    if (!this.isConfigured()) {
      throw new FantasyProviderError("Yahoo credentials are not configured.", "not_configured");
    }
    const params = new URLSearchParams({
      client_id: process.env.YAHOO_CLIENT_ID!,
      redirect_uri: redirectUri,
      response_type: "code",
      state,
    });
    return `https://api.login.yahoo.com/oauth2/request_auth?${params.toString()}`;
  }

  async getUser(): Promise<FantasyUser> {
    throw this.notReady();
  }

  async getLeagues(): Promise<NormalizedLeague[]> {
    throw this.notReady();
  }

  async getScoringSettings(): Promise<ScoringSettings> {
    throw this.notReady();
  }

  async syncUserFantasyData(): Promise<FantasySyncResult> {
    throw this.notReady();
  }

  private notReady(): FantasyProviderError {
    return new FantasyProviderError(
      this.isConfigured()
        ? "Yahoo token exchange is not wired up yet — complete the OAuth flow described in yahoo.ts."
        : "Yahoo requires YAHOO_CLIENT_ID and YAHOO_CLIENT_SECRET to be configured.",
      "not_configured"
    );
  }
}

export const yahooProvider = new YahooFantasyProvider();
