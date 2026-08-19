"use client";

import { useEffect } from "react";
import { DataGate } from "@/components/DataGate";
import { PageHeader } from "@/components/PageHeader";
import { NFLGameCard } from "@/components/NFLGameCard";
import { EmptyState } from "@/components/ui/states";
import { track } from "@/lib/analytics";

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
                    ? "Your fantasy data is real, but no live NFL provider is set up. Add SPORTRADAR_API_KEY to light up live scores, possession and field position — or explore demo mode."
                    : "Check back when the NFL schedule for your week is available."
                }
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
