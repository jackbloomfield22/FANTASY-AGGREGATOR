"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import type { PortfolioPlayer, RankedGame } from "@/lib/types";
import { DataGate } from "@/components/DataGate";
import { EmptyState } from "@/components/ui/states";
import { LiveIndicator } from "@/components/ui/badges";
import { PlayerAvatar, POSITION_TEXT } from "@/components/PlayerAvatar";
import { statLineText } from "@/components/PlayerStatLine";
import { WINDOW_LABELS, windowForGame } from "@/lib/portfolio/windows";
import { cn, formatPoints, gameKickoffLabel, gamePhaseLabel, POSITION_ORDER } from "@/lib/utils";
import { track } from "@/lib/analytics";

/**
 * LIVE — the couch view, organised by what is actually happening:
 *
 *   ON NOW   games in progress, fully expanded: score + clock, then your
 *            players in them (starters by default) with live points.
 *   UP NEXT  games still to kick off — one line each, tap to expand.
 *   FINAL    finished games — one line each with your total, tap to expand.
 *
 * Status comes from the live feed, never from guessing kickoff windows.
 */

const isOn = (g: RankedGame) => g.game.status === "live" || g.game.status === "halftime";

function myPlayers(rg: RankedGame, startersOnly: boolean): PortfolioPlayer[] {
  return (startersOnly ? rg.players.filter((p) => p.starterCount > 0) : rg.players)
    .slice()
    .sort(
      (a, b) =>
        b.starterCount - a.starterCount ||
        b.pointsPerLineup - a.pointsPerLineup ||
        (b.projectedPerLineup ?? 0) - (a.projectedPerLineup ?? 0) ||
        (POSITION_ORDER[a.player.position] ?? 9) - (POSITION_ORDER[b.player.position] ?? 9)
    );
}

/**
 * "Dynasty · Office · BN Work" — which lineups he's in. Per-league numbers
 * appear only when leagues disagree (different scoring rules), so the big
 * number on the right normally speaks for every lineup.
 */
function leagueLine(p: PortfolioPlayer, startersOnly: boolean): string {
  const starters = p.leagues.filter((l) => l.isStarter);
  const bench = p.leagues.filter((l) => !l.isStarter);
  const value = (l: PortfolioPlayer["leagues"][number]) =>
    l.points > 0 ? l.points : (l.projectedPoints ?? 0);
  const differ = new Set(starters.map((l) => formatPoints(value(l)))).size > 1;
  const name = (l: PortfolioPlayer["leagues"][number]) =>
    differ ? `${l.leagueName} ${formatPoints(value(l))}` : l.leagueName;
  const parts: string[] = [];
  if (starters.length > 0) parts.push(starters.map(name).join(" · "));
  if (bench.length > 0 && !startersOnly) parts.push(`BN ${bench.map((l) => l.leagueName).join(" · ")}`);
  return parts.join("  ·  ");
}

function PlayerLine({ p, startersOnly }: { p: PortfolioPlayer; startersOnly: boolean }) {
  const scored = p.stats !== null || p.pointsPerLineup > 0;
  const line = statLineText(p.player.position, p.stats);
  return (
    <li className="flex items-center gap-2.5 px-3 py-2">
      <PlayerAvatar player={p.player} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 leading-tight">
          <Link href={`/players/${p.player.id}`} className="truncate text-sm font-bold text-ink hover:text-accent">
            {p.player.fullName}
          </Link>
          <span className={cn("shrink-0 text-[10px] font-bold", POSITION_TEXT[p.player.position])}>
            {p.player.position}
          </span>
          {p.starterCount === 0 ? (
            <span className="shrink-0 rounded border border-edge bg-surface-2 px-1 text-[8px] font-bold tracking-wider text-ink-faint">
              BENCH
            </span>
          ) : p.starterCount > 1 ? (
            <span className="shrink-0 rounded border border-win/40 bg-win/10 px-1 text-[8px] font-bold tracking-wider text-win">
              ×{p.starterCount}
            </span>
          ) : null}
          {p.player.injury ? (
            <span className="shrink-0 text-[9px] font-bold text-warn">{p.player.injuryLabel}</span>
          ) : null}
        </p>
        <p className="tnum truncate text-[11px] leading-tight text-ink-dim">
          {line !== "—" ? line : "No stats yet"}
        </p>
        <p className="text-[10px] leading-tight text-ink-faint">{leagueLine(p, startersOnly)}</p>
      </div>
      <div className="shrink-0 text-right">
        <span className={cn("tnum block text-2xl font-black leading-none", scored ? "text-ink" : "text-ink-faint")}>
          {scored ? formatPoints(p.pointsPerLineup) : p.projectedPerLineup ? formatPoints(p.projectedPerLineup) : "—"}
        </span>
        <span className="text-[9px] font-semibold tracking-wider text-ink-faint">{scored ? "PTS" : "PROJ"}</span>
      </div>
    </li>
  );
}

/** Big game header: teams, score, clock. */
function GameHeader({ rg, players }: { rg: RankedGame; players: PortfolioPlayer[] }) {
  const { game } = rg;
  const on = isOn(rg);
  const started = game.status !== "scheduled";
  const starters = players.filter((p) => p.starterCount > 0).length;
  const total = players.reduce((s, p) => s + p.pointsPerLineup, 0);
  return (
    <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="tnum text-2xl font-black leading-none text-ink">
          {game.awayTeam}
          {started ? <span className="ml-1.5">{game.awayScore}</span> : null}
          <span className="mx-2 text-base font-bold text-ink-faint">@</span>
          {game.homeTeam}
          {started ? <span className="ml-1.5">{game.homeScore}</span> : null}
        </p>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] font-semibold text-ink-dim">
          {on ? (
            <LiveIndicator label={gamePhaseLabel(game)} />
          ) : (
            <span>{game.status === "final" ? "Final" : gameKickoffLabel(game)}</span>
          )}
          {on && game.possessionTeam ? <span>{game.possessionTeam} ball</span> : null}
          {game.redZone ? <span className="font-bold text-redzone">RED ZONE</span> : null}
        </p>
      </div>
      <p className="tnum shrink-0 text-right text-[11px] font-semibold leading-tight text-ink-dim">
        {players.length === 0 ? (
          <span className="text-ink-faint">none of yours</span>
        ) : (
          <>
            {starters} starter{starters === 1 ? "" : "s"}
            {started && total > 0 ? (
              <span className="block text-sm font-black text-ink">{formatPoints(total)} pts</span>
            ) : null}
          </>
        )}
      </p>
    </div>
  );
}

/** A game that is on: always expanded. */
function LiveGame({ rg, startersOnly }: { rg: RankedGame; startersOnly: boolean }) {
  const players = myPlayers(rg, startersOnly);
  return (
    <article
      aria-label={`${rg.game.awayTeam} at ${rg.game.homeTeam}`}
      className={cn("overflow-hidden rounded-xl border border-edge-strong bg-surface", rg.game.redZone && "redzone-glow")}
    >
      <div className="px-3 py-2.5">
        <GameHeader rg={rg} players={players} />
      </div>
      {players.length > 0 ? (
        <ul className="divide-y divide-edge/60 border-t border-edge">
          {players.map((p) => (
            <PlayerLine key={p.player.id} p={p} startersOnly={startersOnly} />
          ))}
        </ul>
      ) : null}
    </article>
  );
}

/** Upcoming / final game: one line, tap to expand. */
function CollapsedGame({
  rg,
  startersOnly,
  defaultOpen = false,
}: {
  rg: RankedGame;
  startersOnly: boolean;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const players = myPlayers(rg, startersOnly);
  const { game } = rg;
  const started = game.status !== "scheduled";
  const total = players.reduce((s, p) => s + p.pointsPerLineup, 0);
  const starters = players.filter((p) => p.starterCount > 0).length;
  return (
    <li className="rounded-lg border border-edge bg-surface">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-3 py-2 text-left"
      >
        <span className="tnum min-w-[7.5rem] shrink-0 whitespace-nowrap text-sm font-black text-ink">
          {game.awayTeam}
          {started ? ` ${game.awayScore}` : ""}
          <span className="mx-1 font-medium text-ink-faint">@</span>
          {game.homeTeam}
          {started ? ` ${game.homeScore}` : ""}
        </span>
        <span className="tnum min-w-0 flex-1 truncate text-[11px] font-semibold text-ink-dim">
          {started ? "Final" : gameKickoffLabel(game)}
          {players.length > 0 ? (
            <>
              {" · "}
              {starters} starter{starters === 1 ? "" : "s"}
              {!startersOnly && players.length > starters ? ` · ${players.length - starters} bench` : ""}
            </>
          ) : (
            <span className="text-ink-faint"> · none of yours</span>
          )}
        </span>
        {started && total > 0 ? (
          <span className="tnum shrink-0 text-sm font-black text-ink">{formatPoints(total)}</span>
        ) : null}
        <ChevronDown size={14} aria-hidden className={cn("shrink-0 text-ink-faint transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        players.length > 0 ? (
          <ul className="divide-y divide-edge/60 border-t border-edge">
            {players.map((p) => (
              <PlayerLine key={p.player.id} p={p} startersOnly={startersOnly} />
            ))}
          </ul>
        ) : (
          <p className="border-t border-edge px-3 py-2 text-xs text-ink-faint">
            You don&apos;t roster anyone in this game.
          </p>
        )
      ) : null}
    </li>
  );
}

function SectionTitle({ children, tone }: { children: React.ReactNode; tone?: "live" }) {
  return (
    <h2
      className={cn(
        "flex items-center gap-2 text-[11px] font-bold tracking-[0.14em]",
        tone === "live" ? "text-live" : "text-ink-faint"
      )}
    >
      {tone === "live" ? <LiveIndicator label="" /> : null}
      {children}
      <span className="h-px flex-1 bg-edge" aria-hidden />
    </h2>
  );
}

/** Group games by their kickoff window, in kickoff order. */
function byWindow(games: RankedGame[]): { label: string; games: RankedGame[] }[] {
  const groups = new Map<string, RankedGame[]>();
  for (const rg of games) {
    const id = windowForGame(rg.game);
    const list = groups.get(id) ?? [];
    list.push(rg);
    groups.set(id, list);
  }
  return [...groups.entries()]
    .map(([id, list]) => ({
      label: WINDOW_LABELS[id as keyof typeof WINDOW_LABELS].label,
      games: list.sort((a, b) => a.game.kickoffAt.localeCompare(b.game.kickoffAt) || b.starterCount - a.starterCount),
    }))
    .sort((a, b) => a.games[0].game.kickoffAt.localeCompare(b.games[0].game.kickoffAt));
}

export default function LivePage() {
  const [startersOnly, setStartersOnly] = useState(true);

  useEffect(() => {
    track("live_viewed");
  }, []);

  return (
    <DataGate>
      {(portfolio, snapshot) => {
        const games = portfolio.games;
        const on = games
          .filter(isOn)
          .sort((a, b) => b.starterCount - a.starterCount || b.importanceScore - a.importanceScore);
        const onWithMine = on.filter((g) => myPlayers(g, startersOnly).length > 0);
        const onWithoutMine = on.filter((g) => myPlayers(g, startersOnly).length === 0);
        const upcoming = games.filter((g) => g.game.status === "scheduled");
        const finals = games
          .filter((g) => g.game.status === "final")
          .sort((a, b) => b.starterCount - a.starterCount || b.game.kickoffAt.localeCompare(a.game.kickoffAt));
        const upcomingWindows = byWindow(upcoming);
        const nextUp = upcomingWindows[0]?.games[0]?.game ?? null;

        return (
          <div className="space-y-5">
            <header className="flex items-center justify-between gap-2">
              <div className="flex items-baseline gap-2">
                <h1 className="text-xl font-black uppercase tracking-wide text-ink">Live</h1>
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

            {games.length === 0 ? (
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
                {/* ON NOW */}
                <section aria-label="Games on now" className="space-y-3">
                  <SectionTitle tone={on.length > 0 ? "live" : undefined}>
                    ON NOW{on.length > 0 ? ` · ${on.length}` : ""}
                  </SectionTitle>
                  {on.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-edge bg-surface px-4 py-6 text-center">
                      <p className="text-sm font-semibold text-ink">Nothing on right now</p>
                      {nextUp ? (
                        <p className="tnum mt-1 text-xs text-ink-dim">
                          Next kickoff: {nextUp.awayTeam} @ {nextUp.homeTeam} · {gameKickoffLabel(nextUp)}
                        </p>
                      ) : (
                        <p className="mt-1 text-xs text-ink-dim">The week is done.</p>
                      )}
                    </div>
                  ) : (
                    <>
                      {onWithMine.map((rg) => (
                        <LiveGame key={rg.game.id} rg={rg} startersOnly={startersOnly} />
                      ))}
                      {onWithoutMine.length > 0 ? (
                        <ul className="space-y-1.5">
                          {onWithoutMine.map((rg) => (
                            <CollapsedGame key={rg.game.id} rg={rg} startersOnly={startersOnly} />
                          ))}
                        </ul>
                      ) : null}
                    </>
                  )}
                </section>

                {/* UP NEXT */}
                {upcoming.length > 0 ? (
                  <section aria-label="Games up next" className="space-y-3">
                    <SectionTitle>UP NEXT · {upcoming.length}</SectionTitle>
                    {upcomingWindows.map((w, i) => (
                      <div key={w.label}>
                        <h3 className="mb-1.5 text-[10px] font-bold tracking-[0.14em] text-ink-dim">
                          {w.label.toUpperCase()}
                        </h3>
                        <ul className="space-y-1.5">
                          {w.games.map((rg) => (
                            <CollapsedGame
                              key={rg.game.id}
                              rg={rg}
                              startersOnly={startersOnly}
                              // With nothing on, open the next slate's games you have starters in.
                              defaultOpen={on.length === 0 && i === 0 && rg.starterCount > 0}
                            />
                          ))}
                        </ul>
                      </div>
                    ))}
                  </section>
                ) : null}

                {/* FINAL */}
                {finals.length > 0 ? (
                  <section aria-label="Finished games" className="space-y-3">
                    <SectionTitle>FINAL · {finals.length}</SectionTitle>
                    <ul className="space-y-1.5">
                      {finals.map((rg) => (
                        <CollapsedGame key={rg.game.id} rg={rg} startersOnly={startersOnly} />
                      ))}
                    </ul>
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
