"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import type { PortfolioPlayer, RankedGame } from "@/lib/types";
import { DataGate } from "@/components/DataGate";
import { PageHeader } from "@/components/PageHeader";
import { PlayerAvatar, POSITION_TEXT } from "@/components/PlayerAvatar";
import { statLineText } from "@/components/PlayerStatLine";
import { LeagueScoreChips } from "@/components/LeagueChip";
import { EmptyState } from "@/components/ui/states";
import { LiveIndicator } from "@/components/ui/badges";
import { cn, gamePhaseLabel, kickoffLabel, POSITION_ORDER } from "@/lib/utils";
import { track } from "@/lib/analytics";

/**
 * My NFL Week: every game of the week segmented by DATE, then by kickoff
 * TIME. Each game expands to show all of your players in it, sorted by
 * position and then by exposure within the position.
 */

const EXPOSURE_LABEL: Record<RankedGame["exposureLevel"], string> = {
  high: "HIGH EXPOSURE",
  medium: "MEDIUM EXPOSURE",
  low: "LOW EXPOSURE",
  none: "NO PLAYERS",
};

/** Sort a game's players: position order first, exposure within position. */
function sortGamePlayers(players: PortfolioPlayer[]): PortfolioPlayer[] {
  return [...players].sort(
    (a, b) =>
      (POSITION_ORDER[a.player.position] ?? 9) - (POSITION_ORDER[b.player.position] ?? 9) ||
      b.starterExposure - a.starterExposure ||
      b.rosterExposure - a.rosterExposure ||
      a.player.fullName.localeCompare(b.player.fullName)
  );
}

function PlayerRow({ p }: { p: PortfolioPlayer }) {
  const line = statLineText(p.player.position, p.stats);
  return (
    <li className="flex items-start gap-2.5 px-3 py-1.5">
      <PlayerAvatar player={p.player} size="sm" className="h-6 w-6 text-[9px]" />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <Link
            href={`/players/${p.player.id}`}
            className="truncate text-xs font-semibold text-ink hover:text-accent"
          >
            {p.player.fullName}
          </Link>
        </span>
        <span className="tnum block truncate text-[10px] text-ink-faint">
          <span className={cn("font-bold", POSITION_TEXT[p.player.position])}>
            {p.player.position}
          </span>
          {" · "}
          {p.player.nflTeam}
          {line !== "—" ? ` · ${line}` : ""}
        </span>
        {/* His outcome in each league — not a "START ×2" rollup. */}
        <LeagueScoreChips contexts={p.leagues} className="mt-1" />
      </span>
    </li>
  );
}

function GameDisclosure({ ranked }: { ranked: RankedGame }) {
  const [open, setOpen] = useState(false);
  const { game, players } = ranked;
  const isLive = game.status === "live" || game.status === "halftime";
  const started = game.status !== "scheduled";
  const sorted = sortGamePlayers(players);

  return (
    <div
      className={cn(
        "rounded-lg border bg-surface transition-colors",
        open ? "border-edge-strong" : "border-edge hover:border-edge-strong",
        game.redZone && "redzone-glow"
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={`${open ? "Hide" : "Show"} your players in ${game.awayTeam} at ${game.homeTeam}`}
        className="grid w-full cursor-pointer grid-cols-[1fr_auto_auto] items-center gap-x-3 px-3.5 py-2.5 text-left"
      >
        <span className="min-w-0">
          <span className="tnum flex flex-wrap items-center gap-x-2 text-sm font-bold text-ink">
            <span>
              {game.awayTeam}
              {started ? ` ${game.awayScore}` : ""}
              <span className="mx-1 font-medium text-ink-faint">@</span>
              {game.homeTeam}
              {started ? ` ${game.homeScore}` : ""}
            </span>
            {isLive ? (
              <LiveIndicator label={gamePhaseLabel(game)} />
            ) : (
              <span className="text-[11px] font-semibold text-ink-dim">
                {game.status === "final" ? "Final" : ""}
              </span>
            )}
          </span>
          <span className="tnum block text-[11px] text-ink-dim">
            {players.length > 0
              ? `${players.length} rostered · ${ranked.starterCount} starting · ${ranked.benchCount} bench-only`
              : "None of your players"}
          </span>
        </span>
        <span
          className={cn(
            "hidden rounded border px-1.5 py-0.5 text-[9px] font-bold tracking-wider sm:inline-flex",
            ranked.exposureLevel === "high"
              ? "border-accent/40 bg-accent/10 text-accent"
              : "border-edge bg-surface-2 text-ink-faint"
          )}
        >
          {EXPOSURE_LABEL[ranked.exposureLevel]}
        </span>
        <ChevronDown
          size={14}
          aria-hidden
          className={cn("shrink-0 text-ink-faint transition-transform", open && "rotate-180")}
        />
      </button>

      {open ? (
        <div className="border-t border-edge">
          {sorted.length > 0 ? (
            <ul className="divide-y divide-edge/60">
              {sorted.map((p) => (
                <PlayerRow key={p.player.id} p={p} />
              ))}
            </ul>
          ) : (
            <p className="px-3.5 py-2.5 text-xs text-ink-faint">
              You don&apos;t roster anyone in this game.
            </p>
          )}
          <div className="border-t border-edge/60 px-3.5 py-2">
            <Link
              href={`/games/${game.id}`}
              className="text-[11px] font-semibold text-accent hover:underline"
            >
              Full game detail →
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}

interface TimeGroup {
  label: string | null; // null when the schedule source has no real time
  key: string;
  games: RankedGame[];
}
interface DateGroup {
  label: string;
  key: string;
  times: TimeGroup[];
}

/** Segment the week's games by calendar date, then by kickoff time. */
function groupByDateAndTime(games: RankedGame[]): DateGroup[] {
  const dates = new Map<string, { label: string; times: Map<string, TimeGroup> }>();
  for (const rg of games) {
    const g = rg.game;
    const timeKnown = g.kickoffTimeKnown !== false;
    const anchor = !timeKnown && g.kickoffDate ? new Date(`${g.kickoffDate}T12:00:00Z`) : new Date(g.kickoffAt);
    const valid = !Number.isNaN(anchor.getTime());
    const dateKey = valid
      ? !timeKnown && g.kickoffDate
        ? g.kickoffDate
        : `${anchor.getFullYear()}-${String(anchor.getMonth() + 1).padStart(2, "0")}-${String(anchor.getDate()).padStart(2, "0")}`
      : "unknown";
    const dateLabel = valid
      ? anchor
          .toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })
          .toUpperCase()
      : "DATE TBD";
    const timeKey = timeKnown && valid ? g.kickoffAt.slice(11, 16) : "tbd";
    const timeLabel = timeKnown && valid ? kickoffLabel(g.kickoffAt) : null;

    const dateEntry = dates.get(dateKey) ?? { label: dateLabel, times: new Map() };
    const timeEntry = dateEntry.times.get(timeKey) ?? { label: timeLabel, key: timeKey, games: [] };
    timeEntry.games.push(rg);
    dateEntry.times.set(timeKey, timeEntry);
    dates.set(dateKey, dateEntry);
  }

  return [...dates.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, d]) => ({
      key,
      label: d.label,
      times: [...d.times.values()]
        .sort((a, b) => (a.games[0]?.game.kickoffAt ?? "").localeCompare(b.games[0]?.game.kickoffAt ?? ""))
        .map((t) => ({
          ...t,
          // Within a time slot: your exposure decides the order.
          games: [...t.games].sort((x, y) => y.importanceScore - x.importanceScore),
        })),
    }));
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

        if (games.length === 0) {
          return (
            <div className="space-y-3">
              <PageHeader title="My NFL Week" />
              <EmptyState
                title={
                  snapshot.meta.liveSource === "none"
                    ? "No live NFL data configured"
                    : "Game schedule temporarily unavailable"
                }
                message={
                  snapshot.meta.liveSource === "none"
                    ? "Your fantasy scoring is live from Sleeper. For real NFL game detail here (score, clock, possession, field position), add SPORTRADAR_API_KEY."
                    : "Sleeper isn't returning the NFL schedule right now. Your player stats and league scoring stay live — game cards come back automatically once the schedule feed responds."
                }
              />
            </div>
          );
        }

        const groups = groupByDateAndTime(games);

        return (
          <div className="space-y-5">
            <PageHeader
              title="My NFL Week"
              subtitle={
                <span className="tnum">
                  Week {snapshot.meta.week} · {withPlayers.length} of {games.length} games involve
                  your players — expand a game to see them
                </span>
              }
            />

            {groups.map((dg) => (
              <section key={dg.key} aria-label={dg.label}>
                <h2 className="mb-2 flex items-center gap-2 text-[11px] font-bold tracking-[0.14em] text-ink-faint">
                  {dg.label}
                  <span className="h-px flex-1 bg-edge" aria-hidden />
                </h2>
                <div className="space-y-3">
                  {dg.times.map((tg) => (
                    <div key={tg.key}>
                      {tg.label ? (
                        <h3 className="tnum mb-1.5 text-[10px] font-bold tracking-[0.14em] text-ink-dim">
                          {tg.label}
                        </h3>
                      ) : null}
                      <div className="space-y-2">
                        {tg.games.map((rg) => (
                          <GameDisclosure key={rg.game.id} ranked={rg} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        );
      }}
    </DataGate>
  );
}
