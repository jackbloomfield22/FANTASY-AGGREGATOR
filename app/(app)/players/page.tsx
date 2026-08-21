"use client";

import { useEffect, useState } from "react";
import type { PortfolioPlayer } from "@/lib/types";
import { DataGate } from "@/components/DataGate";
import { PageHeader } from "@/components/PageHeader";
import { PlayerListRow } from "@/components/PlayerListRow";
import { FilterSelect } from "@/components/FilterBar";
import { ActivityTicker } from "@/components/ActivityTicker";
import { EmptyState } from "@/components/ui/states";
import { LiveIndicator } from "@/components/ui/badges";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";

/**
 * Players, grouped by what matters on a Sunday:
 *   LIVE NOW (highest-scoring first) → UP NEXT (by kickoff) → FINISHED.
 * No filter wall — two small selects, and the groups do the sorting.
 */

const isLiveNow = (p: PortfolioPlayer) =>
  p.liveStatus === "live" || p.liveStatus === "red_zone" || p.liveStatus === "halftime";

function Section({
  title,
  count,
  tone,
  children,
}: {
  title: string;
  count: number;
  tone?: "live";
  children: React.ReactNode;
}) {
  if (count === 0) return null;
  return (
    <section aria-label={title}>
      <div className="mb-2 flex items-center gap-2">
        {tone === "live" ? <LiveIndicator label="" /> : null}
        <h2
          className={cn(
            "text-[11px] font-bold tracking-[0.14em]",
            tone === "live" ? "text-live" : "text-ink-faint"
          )}
        >
          {title}
        </h2>
        <span className="tnum text-[11px] font-bold text-ink-faint">{count}</span>
        <span className="h-px flex-1 bg-edge" aria-hidden />
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

export default function PlayersPage() {
  const [position, setPosition] = useState("all");
  const [leagueId, setLeagueId] = useState("all");

  useEffect(() => {
    track("players_viewed");
  }, []);

  return (
    <DataGate>
      {(portfolio, snapshot) => {
        const { players } = portfolio;
        const positions = Array.from(new Set(players.map((p) => p.player.position))).sort();
        const leagues = Array.from(
          new Map(
            players.flatMap((p) => p.leagues.map((l) => [l.leagueId, l.leagueName] as const))
          ).entries()
        );

        const filtered = players.filter(
          (p) =>
            (position === "all" || p.player.position === position) &&
            (leagueId === "all" || p.leagues.some((l) => l.leagueId === leagueId))
        );

        const live = filtered
          .filter(isLiveNow)
          .sort((a, b) => b.portfolioImpact - a.portfolioImpact || b.benchPoints - a.benchPoints);
        const upcoming = filtered
          .filter((p) => p.liveStatus === "upcoming" || p.liveStatus === "no_game")
          .sort((a, b) => (a.game?.kickoffAt ?? "9999").localeCompare(b.game?.kickoffAt ?? "9999"));
        const finished = filtered
          .filter((p) => p.liveStatus === "final")
          .sort((a, b) => b.portfolioImpact - a.portfolioImpact || b.benchPoints - a.benchPoints);

        return (
          <div className="space-y-4">
            <PageHeader
              title="My Players"
              subtitle={
                <span className="tnum">
                  {filtered.length} players · {live.length} live now · {upcoming.length} up next ·{" "}
                  {finished.length} finished
                </span>
              }
              right={
                <>
                  <FilterSelect
                    label="Pos"
                    value={position}
                    onChange={(v) => {
                      setPosition(v);
                      track("filter_used", { page: "players", filter: "position", value: v });
                    }}
                    options={[{ value: "all", label: "All" }, ...positions.map((p) => ({ value: p, label: p }))]}
                  />
                  <FilterSelect
                    label="League"
                    value={leagueId}
                    onChange={(v) => {
                      setLeagueId(v);
                      track("filter_used", { page: "players", filter: "league", value: v });
                    }}
                    options={[
                      { value: "all", label: "All" },
                      ...leagues.map(([id, name]) => ({ value: id, label: name })),
                    ]}
                  />
                </>
              }
            />

            {snapshot.alerts.length > 0 ? (
              <section aria-label="Live activity ticker">
                <h2 className="mb-1.5 text-[10px] font-bold tracking-[0.14em] text-ink-faint">
                  LIVE ACTIVITY
                </h2>
                <ActivityTicker alerts={snapshot.alerts} limit={12} />
              </section>
            ) : null}

            {filtered.length === 0 ? (
              <EmptyState
                title="No players match these filters"
                message="Try clearing the position or league selection."
              />
            ) : (
              <>
                <Section title="LIVE NOW" count={live.length} tone="live">
                  {live.map((p) => (
                    <PlayerListRow key={p.player.id} player={p} />
                  ))}
                </Section>
                <Section title="UP NEXT" count={upcoming.length}>
                  {upcoming.map((p) => (
                    <PlayerListRow key={p.player.id} player={p} />
                  ))}
                </Section>
                <Section title="FINISHED" count={finished.length}>
                  {finished.map((p) => (
                    <PlayerListRow key={p.player.id} player={p} />
                  ))}
                </Section>
              </>
            )}
          </div>
        );
      }}
    </DataGate>
  );
}
