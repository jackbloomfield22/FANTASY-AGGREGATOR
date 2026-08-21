"use client";

import Link from "next/link";
import { DataGate } from "@/components/DataGate";
import { PortfolioSummary } from "@/components/PortfolioSummary";
import { MatchupStrip } from "@/components/MatchupStrip";
import { ImportantGameCard } from "@/components/NFLGameCard";
import { PlayerCard } from "@/components/PlayerCard";
import { LiveFeed } from "@/components/LiveFeed";
import { EmptyState } from "@/components/ui/states";
import { kickoffLabel } from "@/lib/utils";

/**
 * Your Sunday, in reading order:
 *   the four numbers → am I winning? → what's happening → the game to watch.
 */
export default function DashboardPage() {
  return (
    <DataGate>
      {(portfolio, snapshot) => {
        const { summary, mostImportantGame, biggestSwing, matchups } = portfolio;
        const anyLive = summary.gamesLive > 0;
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
                <MatchupStrip matchups={matchups} />
              </section>
            ) : null}

            <div className="grid gap-4 lg:grid-cols-3">
              <div className="order-2 space-y-4 lg:order-1 lg:col-span-2">
                <section aria-label="Live activity">
                  <div className="mb-2 flex items-center justify-between">
                    <h2 className="text-[11px] font-bold tracking-[0.14em] text-ink-faint">
                      LIVE ACTIVITY
                    </h2>
                    <Link href="/players" className="text-[11px] font-semibold text-accent hover:underline">
                      All players →
                    </Link>
                  </div>
                  <LiveFeed alerts={snapshot.alerts} limit={8} />
                </section>
              </div>

              <div className="order-1 space-y-4 lg:order-2">
                {mostImportantGame ? (
                  <ImportantGameCard ranked={mostImportantGame} />
                ) : (
                  <EmptyState
                    title="No NFL games with your players"
                    message="Once games involve your rostered players, the most important one shows here."
                  />
                )}
                {biggestSwing ? (
                  <section aria-label="Biggest swing player">
                    <h2 className="mb-2 text-[11px] font-bold tracking-[0.14em] text-ink-faint">
                      BIGGEST SWING
                    </h2>
                    <PlayerCard player={biggestSwing} />
                  </section>
                ) : null}
              </div>
            </div>
          </div>
        );
      }}
    </DataGate>
  );
}
