"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { PortfolioPlayer, RankedGame } from "@/lib/types";
import { DataGate } from "@/components/DataGate";
import { EmptyState } from "@/components/ui/states";
import { LiveIndicator } from "@/components/ui/badges";
import { PlayerAvatar, POSITION_TEXT } from "@/components/PlayerAvatar";
import { LeagueScoreChips } from "@/components/LeagueChip";
import { statLineText } from "@/components/PlayerStatLine";
import {
  buildWindows,
  defaultWindowId,
  type GameWindow,
  type WindowId,
} from "@/lib/portfolio/windows";
import { cn, formatPoints, gameKickoffLabel, gamePhaseLabel, POSITION_ORDER } from "@/lib/utils";
import { track } from "@/lib/analytics";

/**
 * LIVE — the couch view. Which games are on right now, and which of my
 * players are in them. One window at a time (TNF / SUN 1PM / SUN 4PM / SNF /
 * MNF), big game headers, players grouped underneath, nothing else.
 */

function windowHint(w: GameWindow): string {
  if (w.state === "live") return "LIVE";
  if (w.state === "final") return "FINAL";
  const first = w.games[0]?.game;
  return first ? gameKickoffLabel(first) : "";
}

function WindowTabs({
  windows,
  activeId,
  onSelect,
}: {
  windows: GameWindow[];
  activeId: WindowId | null;
  onSelect: (id: WindowId) => void;
}) {
  return (
    <div role="tablist" aria-label="Game windows" className="scroll-thin -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
      {windows.map((w) => {
        const active = w.id === activeId;
        return (
          <button
            key={w.id}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onSelect(w.id)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold tracking-wide transition-colors",
              active
                ? "border-accent bg-accent text-accent-ink"
                : "border-edge bg-surface text-ink-dim hover:border-edge-strong hover:text-ink"
            )}
          >
            {w.state === "live" ? (
              <span
                aria-hidden
                className={cn("inline-block h-1.5 w-1.5 rounded-full", active ? "bg-accent-ink" : "bg-live")}
              />
            ) : null}
            {w.short}
            <span className={cn("tnum text-[9px] font-semibold", active ? "opacity-80" : "text-ink-faint")}>
              {windowHint(w)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function PlayerRow({ p, startersOnly }: { p: PortfolioPlayer; startersOnly: boolean }) {
  const hasPoints = p.stats !== null || p.pointsPerLineup > 0;
  const contexts = startersOnly ? p.leagues.filter((l) => l.isStarter) : p.leagues;
  const line = statLineText(p.player.position, p.stats);
  return (
    <li className="flex items-center gap-2.5 px-3 py-2">
      <PlayerAvatar player={p.player} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <Link href={`/players/${p.player.id}`} className="truncate text-sm font-bold text-ink hover:text-accent">
            {p.player.fullName}
          </Link>
          <span className={cn("shrink-0 text-[10px] font-bold", POSITION_TEXT[p.player.position])}>
            {p.player.position}
          </span>
          <span className="shrink-0 text-[10px] font-semibold text-ink-faint">{p.player.nflTeam}</span>
          {p.player.injury ? (
            <span className="shrink-0 rounded border border-warn/40 bg-warn/10 px-1 py-px text-[8px] font-bold tracking-wider text-warn">
              {p.player.injuryLabel ?? p.player.injury.toUpperCase()}
            </span>
          ) : null}
        </div>
        {line !== "—" ? (
          <p className="tnum truncate text-[11px] text-ink-dim">{line}</p>
        ) : null}
        <LeagueScoreChips contexts={contexts} className="mt-1" />
      </div>
      <div className="shrink-0 text-right">
        {hasPoints ? (
          <>
            <span className="tnum block text-xl font-black leading-none text-ink">
              {formatPoints(p.pointsPerLineup)}
            </span>
            <span className="text-[9px] font-semibold tracking-wider text-ink-faint">PTS</span>
          </>
        ) : p.projectedPerLineup ? (
          <>
            <span className="tnum block text-xl font-black leading-none text-ink-dim">
              {formatPoints(p.projectedPerLineup)}
            </span>
            <span className="text-[9px] font-semibold tracking-wider text-ink-faint">PROJ</span>
          </>
        ) : (
          <span className="text-ink-faint">—</span>
        )}
      </div>
    </li>
  );
}

function GameBlock({ ranked, startersOnly }: { ranked: RankedGame; startersOnly: boolean }) {
  const { game } = ranked;
  const isLive = game.status === "live" || game.status === "halftime";
  const started = game.status !== "scheduled";
  const players = (startersOnly ? ranked.players.filter((p) => p.starterCount > 0) : ranked.players)
    .slice()
    .sort(
      (a, b) =>
        b.starterCount - a.starterCount ||
        b.pointsPerLineup - a.pointsPerLineup ||
        (b.projectedPerLineup ?? 0) - (a.projectedPerLineup ?? 0) ||
        (POSITION_ORDER[a.player.position] ?? 9) - (POSITION_ORDER[b.player.position] ?? 9)
    );
  const starting = players.filter((p) => p.starterCount > 0).length;
  const benchOnly = players.length - starting;

  return (
    <article
      aria-label={`${game.awayTeam} at ${game.homeTeam}`}
      className={cn(
        "overflow-hidden rounded-xl border bg-surface",
        isLive ? "border-edge-strong" : "border-edge",
        game.redZone && "redzone-glow"
      )}
    >
      <header className="flex items-center justify-between gap-3 px-3 py-2.5">
        <div className="min-w-0">
          <p className="tnum text-2xl font-black leading-none text-ink">
            {game.awayTeam}
            {started ? <span className="ml-1.5">{game.awayScore}</span> : null}
            <span className="mx-2 text-base font-bold text-ink-faint">@</span>
            {game.homeTeam}
            {started ? <span className="ml-1.5">{game.homeScore}</span> : null}
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] font-semibold text-ink-dim">
            {isLive ? (
              <LiveIndicator label={gamePhaseLabel(game)} />
            ) : (
              <span>{game.status === "final" ? "Final" : gameKickoffLabel(game)}</span>
            )}
            {isLive && game.possessionTeam ? <span>{game.possessionTeam} ball</span> : null}
            {game.redZone ? <span className="font-bold text-redzone">RED ZONE</span> : null}
          </p>
        </div>
        <p className="tnum shrink-0 text-right text-[10px] font-semibold text-ink-faint">
          {players.length === 0
            ? "none of yours"
            : `${starting} starting${benchOnly > 0 ? ` · ${benchOnly} bench` : ""}`}
        </p>
      </header>
      {players.length > 0 ? (
        <ul className="divide-y divide-edge/60 border-t border-edge">
          {players.map((p) => (
            <PlayerRow key={p.player.id} p={p} startersOnly={startersOnly} />
          ))}
        </ul>
      ) : null}
    </article>
  );
}

export default function LivePage() {
  const [selected, setSelected] = useState<WindowId | null>(null);
  const [startersOnly, setStartersOnly] = useState(true);

  useEffect(() => {
    track("live_viewed");
  }, []);

  return (
    <DataGate>
      {(portfolio, snapshot) => {
        const windows = buildWindows(portfolio.games);
        const activeId =
          selected && windows.some((w) => w.id === selected) ? selected : defaultWindowId(windows);
        const active = windows.find((w) => w.id === activeId) ?? null;
        const anyLive = portfolio.summary.gamesLive > 0;

        return (
          <div className="space-y-3">
            <header className="flex items-center justify-between gap-2">
              <div className="flex items-baseline gap-2">
                <h1 className="flex items-center gap-2 text-xl font-black uppercase tracking-wide text-ink">
                  {anyLive ? <LiveIndicator label="" /> : null}
                  Live
                </h1>
                <span className="tnum text-xs font-semibold text-ink-faint">Week {snapshot.meta.week}</span>
              </div>
              <div
                role="group"
                aria-label="Which players to show"
                className="flex rounded-lg border border-edge bg-surface p-0.5 text-[11px] font-bold"
              >
                <button
                  type="button"
                  aria-pressed={startersOnly}
                  onClick={() => setStartersOnly(true)}
                  className={cn("rounded-md px-2.5 py-1", startersOnly ? "bg-surface-3 text-ink" : "text-ink-faint")}
                >
                  Starters
                </button>
                <button
                  type="button"
                  aria-pressed={!startersOnly}
                  onClick={() => setStartersOnly(false)}
                  className={cn("rounded-md px-2.5 py-1", !startersOnly ? "bg-surface-3 text-ink" : "text-ink-faint")}
                >
                  All rostered
                </button>
              </div>
            </header>

            {windows.length === 0 ? (
              <EmptyState
                title="No game schedule available"
                message="The schedule feed isn't answering right now. Your players and scoring still work."
                action={
                  <Link href="/players" className="text-sm font-semibold text-accent hover:underline">
                    See my players →
                  </Link>
                }
              />
            ) : (
              <>
                <WindowTabs windows={windows} activeId={activeId} onSelect={setSelected} />
                {active ? (
                  <section aria-label={active.label} className="space-y-3">
                    <h2 className="flex items-center gap-2 text-[11px] font-bold tracking-[0.14em] text-ink-faint">
                      {active.label.toUpperCase()}
                      <span className="tnum">· {active.games.length} {active.games.length === 1 ? "game" : "games"}</span>
                      <span className="h-px flex-1 bg-edge" aria-hidden />
                    </h2>
                    {active.games.map((rg) => (
                      <GameBlock key={rg.game.id} ranked={rg} startersOnly={startersOnly} />
                    ))}
                  </section>
                ) : null}
              </>
            )}
          </div>
        );
      }}
    </DataGate>
  );
}
