import type { NormalizedNFLGame, NormalizedPlayerGameStats } from "@/lib/types";
import { DEMO_SEASON, DEMO_WEEK } from "@/lib/demo/data";
import { buildDemoSnapshot } from "@/lib/demo/simulation";
import { LiveSportsProvider } from "./base";

/**
 * Demo live-sports provider — the deterministic simulation exposed through
 * the same interface a production provider (Sportradar) implements. The UI
 * can swap between them without changes.
 */
export class DemoLiveSportsProvider implements LiveSportsProvider {
  readonly id = "demo" as const;

  constructor(private readonly epochOffsetMs = 0) {}

  isConfigured(): boolean {
    return true;
  }

  private snapshot() {
    return buildDemoSnapshot(Date.now(), this.epochOffsetMs);
  }

  async getCurrentWeek(): Promise<{ season: number; week: number }> {
    return { season: DEMO_SEASON, week: DEMO_WEEK };
  }

  async getSchedule(): Promise<NormalizedNFLGame[]> {
    return this.snapshot().games;
  }

  async getLiveGames(): Promise<NormalizedNFLGame[]> {
    return this.snapshot().games.filter((g) => g.status === "live" || g.status === "halftime");
  }

  async getGame(gameId: string): Promise<NormalizedNFLGame | null> {
    return this.snapshot().games.find((g) => g.id === gameId) ?? null;
  }

  async getPlayerGameStats(gameIds: string[]): Promise<NormalizedPlayerGameStats[]> {
    const ids = new Set(gameIds);
    return this.snapshot().playerStats.filter((s) => ids.has(s.gameId));
  }
}

export const demoLiveProvider = new DemoLiveSportsProvider();
