"use client";

import { useEffect, useState } from "react";
import type { PortfolioPlayer } from "@/lib/types";
import { DataGate } from "@/components/DataGate";
import { PageHeader } from "@/components/PageHeader";
import { PlayerListHeader, PlayerListRow } from "@/components/PlayerListRow";
import { FilterBar, FilterSelect } from "@/components/FilterBar";
import { EmptyState } from "@/components/ui/states";
import { StatPill } from "@/components/ui/badges";
import { track } from "@/lib/analytics";
import { useCompactCards } from "@/components/providers/displayPrefs";

type StatusFilter = "all" | "live" | "red_zone" | "starting" | "bench_only" | "upcoming" | "final";
type SortKey = "portfolio" | "points" | "exposure" | "live_first" | "game_time" | "name";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "portfolio", label: "Portfolio Impact" },
  { value: "points", label: "Fantasy Points" },
  { value: "exposure", label: "Exposure" },
  { value: "live_first", label: "Live First" },
  { value: "game_time", label: "Game Time" },
  { value: "name", label: "Player Name" },
];

function matchesStatus(p: PortfolioPlayer, f: StatusFilter): boolean {
  switch (f) {
    case "all":
      return true;
    case "live":
      return p.liveStatus === "live" || p.liveStatus === "red_zone" || p.liveStatus === "halftime";
    case "red_zone":
      return p.liveStatus === "red_zone";
    case "starting":
      return p.starterCount > 0;
    case "bench_only":
      return p.starterCount === 0;
    case "upcoming":
      return p.liveStatus === "upcoming";
    case "final":
      return p.liveStatus === "final";
  }
}

function sortPlayers(list: PortfolioPlayer[], key: SortKey): PortfolioPlayer[] {
  const isLive = (p: PortfolioPlayer) =>
    p.liveStatus === "live" || p.liveStatus === "red_zone" || p.liveStatus === "halftime" ? 1 : 0;
  const sorted = [...list];
  switch (key) {
    case "portfolio":
      sorted.sort((a, b) => b.portfolioImpact - a.portfolioImpact);
      break;
    case "points":
      sorted.sort((a, b) => b.maxPoints - a.maxPoints);
      break;
    case "exposure":
      sorted.sort(
        (a, b) => b.starterExposure - a.starterExposure || b.rosterExposure - a.rosterExposure
      );
      break;
    case "live_first":
      sorted.sort((a, b) => isLive(b) - isLive(a) || b.portfolioImpact - a.portfolioImpact);
      break;
    case "game_time":
      sorted.sort((a, b) =>
        (a.game?.kickoffAt ?? "9999").localeCompare(b.game?.kickoffAt ?? "9999")
      );
      break;
    case "name":
      sorted.sort((a, b) => a.player.fullName.localeCompare(b.player.fullName));
      break;
  }
  return sorted;
}

export default function PlayersPage() {
  const [status, setStatus] = useState<StatusFilter>("all");
  const [position, setPosition] = useState("all");
  const [nflTeam, setNflTeam] = useState("all");
  const [leagueId, setLeagueId] = useState("all");
  const [sort, setSort] = useState<SortKey>("portfolio");
  const compact = useCompactCards();

  useEffect(() => {
    track("players_viewed");
  }, []);

  const setFilter = <T,>(setter: (v: T) => void, name: string) => (v: T) => {
    setter(v);
    track("filter_used", { page: "players", filter: name, value: String(v) });
  };

  return (
    <DataGate>
      {(portfolio) => {
        const { players } = portfolio;
        const counts = {
          all: players.length,
          live: players.filter((p) => matchesStatus(p, "live")).length,
          red_zone: players.filter((p) => matchesStatus(p, "red_zone")).length,
          starting: players.filter((p) => p.starterCount > 0).length,
          bench_only: players.filter((p) => p.starterCount === 0).length,
          upcoming: players.filter((p) => p.liveStatus === "upcoming").length,
          final: players.filter((p) => p.liveStatus === "final").length,
        };
        const positions = Array.from(new Set(players.map((p) => p.player.position))).sort();
        const teams = Array.from(new Set(players.map((p) => p.player.nflTeam))).sort();
        const leagues = Array.from(
          new Map(
            players.flatMap((p) => p.leagues.map((l) => [l.leagueId, l.leagueName] as const))
          ).entries()
        );

        const filtered = sortPlayers(
          players.filter(
            (p) =>
              matchesStatus(p, status) &&
              (position === "all" || p.player.position === position) &&
              (nflTeam === "all" || p.player.nflTeam === nflTeam) &&
              (leagueId === "all" || p.leagues.some((l) => l.leagueId === leagueId))
          ),
          sort
        );

        return (
          <div className="space-y-3">
            <PageHeader
              title="My Players"
              subtitle={
                <span className="tnum">
                  {counts.all} unique · {counts.starting} starting somewhere · {counts.live} live now
                  {counts.red_zone > 0 ? ` · ${counts.red_zone} in red zone` : ""} ·{" "}
                  {counts.upcoming} later · {counts.final} finished
                </span>
              }
            />

            <div className="sticky top-0 z-20 -mx-4 space-y-2 border-b border-edge bg-bg/95 px-4 py-2 backdrop-blur md:top-auto md:z-auto md:mx-0 md:border-0 md:bg-transparent md:px-0 md:backdrop-blur-none">
              <FilterBar
                ariaLabel="Filter players by status"
                value={status}
                onChange={setFilter(setStatus, "status")}
                options={[
                  { value: "all", label: "All", count: counts.all },
                  { value: "live", label: "Live", count: counts.live },
                  { value: "red_zone", label: "Red Zone", count: counts.red_zone },
                  { value: "starting", label: "Starting", count: counts.starting },
                  { value: "bench_only", label: "Bench Only", count: counts.bench_only },
                  { value: "upcoming", label: "Upcoming", count: counts.upcoming },
                  { value: "final", label: "Final", count: counts.final },
                ]}
              />
              <div className="scroll-thin flex flex-wrap items-center gap-2 overflow-x-auto">
                <FilterSelect
                  label="Pos"
                  value={position}
                  onChange={setFilter(setPosition, "position")}
                  options={[{ value: "all", label: "All" }, ...positions.map((p) => ({ value: p, label: p }))]}
                />
                <FilterSelect
                  label="NFL team"
                  value={nflTeam}
                  onChange={setFilter(setNflTeam, "nfl_team")}
                  options={[{ value: "all", label: "All" }, ...teams.map((t) => ({ value: t, label: t }))]}
                />
                <FilterSelect
                  label="League"
                  value={leagueId}
                  onChange={setFilter(setLeagueId, "league")}
                  options={[
                    { value: "all", label: "All" },
                    ...leagues.map(([id, name]) => ({ value: id, label: name })),
                  ]}
                />
                <FilterSelect
                  label="Sort"
                  value={sort}
                  onChange={(v) => {
                    setSort(v as SortKey);
                    track("filter_used", { page: "players", filter: "sort", value: v });
                  }}
                  options={SORT_OPTIONS}
                />
                <StatPill label="Showing" value={filtered.length} className="ml-auto" />
              </div>
            </div>

            {filtered.length === 0 ? (
              <EmptyState
                title="No players match these filters"
                message="Try widening the status filter or clearing position/team selections."
              />
            ) : (
              <div className="space-y-2">
                <PlayerListHeader />
                {filtered.map((p) => (
                  <PlayerListRow key={p.player.id} player={p} compact={compact} />
                ))}
              </div>
            )}
          </div>
        );
      }}
    </DataGate>
  );
}
