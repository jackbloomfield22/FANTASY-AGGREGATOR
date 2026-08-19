"use client";

import Link from "next/link";
import { DataGate } from "@/components/DataGate";
import { PortfolioSummary } from "@/components/PortfolioSummary";
import { ImportantGameCard } from "@/components/NFLGameCard";
import { PlayerCard } from "@/components/PlayerCard";
import { LiveFeed } from "@/components/LiveFeed";
import { WinProbability } from "@/components/FantasyMatchupCard";
import { MatchupStatusBadge } from "@/components/ui/badges";
import { EmptyState } from "@/components/ui/states";
import { cn, formatPoints, kickoffLabel } from "@/lib/utils";

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

            <div className="grid gap-4 lg:grid-cols-3">
              <div className="order-2 space-y-4 lg:order-1 lg:col-span-2">
                {biggestSwing ? (
                  <section aria-label="Biggest swing player">
                    <h2 className="mb-2 text-[11px] font-bold tracking-[0.14em] text-ink-faint">
                      BIGGEST SWING
                    </h2>
                    <PlayerCard player={biggestSwing} />
                  </section>
                ) : null}

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
                    message="Once games are scheduled for your rostered players, the most important one shows here."
                  />
                )}

                <section
                  aria-label="Matchup summary"
                  className="rounded-xl border border-edge bg-surface p-4"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-[11px] font-bold tracking-[0.14em] text-ink-faint">MATCHUPS</h2>
                    <Link href="/teams" className="text-[11px] font-semibold text-accent hover:underline">
                      All →
                    </Link>
                  </div>
                  {matchups.length === 0 ? (
                    <p className="text-sm text-ink-dim">No matchups this week.</p>
                  ) : (
                    <ul className="space-y-3">
                      {matchups.map((m) => (
                        <li key={m.matchup.id}>
                          <Link href={`/teams/${m.matchup.id}`} className="group block">
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate text-xs font-semibold text-ink-dim group-hover:text-ink">
                                {m.league.name}
                              </span>
                              <MatchupStatusBadge
                                status={m.matchup.status}
                                won={m.matchup.status === "final" ? m.matchup.userScore > m.matchup.opponentScore : undefined}
                              />
                            </div>
                            <p className="tnum mt-0.5 text-sm font-bold text-ink">
                              {formatPoints(m.matchup.userScore)}
                              <span className="mx-1 text-ink-faint">—</span>
                              <span className={cn(m.matchup.opponentScore > m.matchup.userScore && "text-ink")}>
                                {formatPoints(m.matchup.opponentScore)}
                              </span>
                            </p>
                            {m.matchup.status !== "final" && m.matchup.winProbability !== null ? (
                              <WinProbability probability={m.matchup.winProbability} className="mt-1" />
                            ) : null}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>
            </div>
          </div>
        );
      }}
    </DataGate>
  );
}
