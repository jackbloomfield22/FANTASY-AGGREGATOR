"use client";

import { useEffect } from "react";
import { DataGate } from "@/components/DataGate";
import { PageHeader } from "@/components/PageHeader";
import { NFLGameCard } from "@/components/NFLGameCard";
import { EmptyState } from "@/components/ui/states";
import { usePortfolio } from "@/components/providers/PortfolioProvider";
import { track } from "@/lib/analytics";

/** One-click simulated Sunday when no live NFL provider is configured. */
function SimulateSundayButton() {
  const { refresh } = usePortfolio();
  return (
    <button
      type="button"
      onClick={async () => {
        await fetch("/api/demo/simulate", { method: "POST" });
        await refresh();
      }}
      className="rounded-md bg-accent px-4 py-2 text-xs font-bold uppercase tracking-wide text-accent-ink hover:opacity-90"
    >
      Simulate a live Sunday
    </button>
  );
}

export default function GamesPage() {
  useEffect(() => {
    track("games_viewed");
  }, []);

  return (
    <DataGate>
      {(portfolio, snapshot) => {
        const games = portfolio.games;
        const withPlayers = games.filter((g) => g.players.length > 0);
        const without = games.filter((g) => g.players.length === 0);

        if (games.length === 0) {
          return (
            <div className="space-y-3">
              <PageHeader title="My NFL Sunday" />
              <EmptyState
                title={snapshot.meta.liveSource === "none" ? "No live NFL data configured" : "No games this week"}
                message={
                  snapshot.meta.liveSource === "none"
                    ? "Your fantasy data is real, but no live NFL provider is set up. Add SPORTRADAR_API_KEY for real live data — or drop your rosters into a simulated mid-Sunday to see everything in motion."
                    : "Check back when the NFL schedule for your week is available."
                }
                action={snapshot.meta.liveSource === "none" ? <SimulateSundayButton /> : undefined}
              />
            </div>
          );
        }

        return (
          <div className="space-y-3">
            <PageHeader
              title="My NFL Sunday"
              subtitle={
                <span className="tnum">
                  Ranked by your fantasy exposure — {withPlayers.length} games involve your players
                </span>
              }
            />
            <div className="grid gap-3 md:grid-cols-2">
              {withPlayers.map((g) => (
                <NFLGameCard key={g.game.id} ranked={g} />
              ))}
            </div>
            {without.length > 0 ? (
              <>
                <h2 className="pt-2 text-[11px] font-bold tracking-[0.14em] text-ink-faint">
                  NO PLAYERS INVOLVED
                </h2>
                <div className="grid gap-3 md:grid-cols-2">
                  {without.map((g) => (
                    <NFLGameCard key={g.game.id} ranked={g} />
                  ))}
                </div>
              </>
            ) : null}
          </div>
        );
      }}
    </DataGate>
  );
}
