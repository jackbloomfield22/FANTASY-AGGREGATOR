"use client";

import Link from "next/link";
import { DataGate } from "@/components/DataGate";
import { PortfolioSummary } from "@/components/PortfolioSummary";
import { MatchupStrip } from "@/components/MatchupStrip";
import { HomePlayersPanel } from "@/components/HomePlayersPanel";
import { ImportantGameCard } from "@/components/NFLGameCard";
import { LiveFeed } from "@/components/LiveFeed";
import { kickoffLabel } from "@/lib/utils";

/**
 * The one-stop Sunday page, in a fantasy player's reading order:
 *   1. the four numbers        — how is my day going?
 *   2. every matchup           — am I winning?
 *   3. my player leaderboard   — who's getting me points right now,
 *      and who is yet to play?
 *   4. live activity + the game to watch.
 */
export default function DashboardPage() {
  return (
    <DataGate>
      {(portfolio, snapshot) => {
        const { summary, mostImportantGame, matchups, players } = portfolio;
        const anyLive = summary.gamesLive > 0;
        const hasGameData = snapshot.games.length > 0;
        const nextKickoff = portfolio.games
          .map((g) => g.game)
          .filter((g) => g.status === "scheduled")
          .sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt))[0];

        return (
          <div className="space-y-4">
            <PortfolioSummary summary={summary} week={snapshot.meta.week} />

            {!anyLive && nextKickoff ? (
              <p className="rounded-lg border border-edge bg-surface px-3 py-2 text-xs font-medium text-ink-dim">
                No games in progress. Next kickoff:{" "}
                <span className="tnum font-bold text-ink">
                  {nextKickoff.awayTeam} @ {nextKickoff.homeTeam} · {kickoffLabel(nextKickoff.kickoffAt)}
                </span>
              </p>
            ) : null}

            {matchups.length > 0 ? (
              <section aria-label="Your matchups">
                <div className="mb-1.5 flex items-center justify-between">
                  <h2 className="text-[11px] font-bold tracking-[0.14em] text-ink-faint">
                    AM I WINNING?
                  </h2>
                  <Link href="/teams" className="text-[11px] font-semibold text-accent hover:underline">
                    All matchups →
                  </Link>
                </div>
                <MatchupStrip matchups={matchups} showRemaining={hasGameData && anyLive} />
              </section>
            ) : null}

            <div className="grid gap-4 lg:grid-cols-5">
              <div className="lg:col-span-3">
                <HomePlayersPanel players={players} />
              </div>

              <div className="space-y-4 lg:col-span-2">
                {snapshot.alerts.length > 0 ? (
                  <section aria-label="Live activity">
                    <div className="mb-1.5 flex items-center justify-between">
                      <h2 className="text-[11px] font-bold tracking-[0.14em] text-ink-faint">
                        LIVE ACTIVITY
                      </h2>
                    </div>
                    <LiveFeed alerts={snapshot.alerts} limit={6} />
                  </section>
                ) : null}
                {mostImportantGame ? <ImportantGameCard ranked={mostImportantGame} /> : null}
              </div>
            </div>
          </div>
        );
      }}
    </DataGate>
  );
}
