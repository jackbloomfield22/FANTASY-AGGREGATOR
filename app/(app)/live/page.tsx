"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { PlayerLeagueContext, PortfolioPlayer, Position } from "@/lib/types";
import { DataGate } from "@/components/DataGate";
import { LiveIndicator } from "@/components/ui/badges";
import { PlayerAvatar, POSITION_TEXT } from "@/components/PlayerAvatar";
import { statLineText } from "@/components/PlayerStatLine";
import { cn, formatPoints, gameKickoffLabel, gamePhaseLabel } from "@/lib/utils";
import { track } from "@/lib/analytics";

/**
 * LIVE — your composite starting lineup for the week: every player you are
 * starting in ANY league, one row each, grouped by position and sorted by
 * fantasy points, with the leagues he's in right on the row. A slim
 * scoreboard of games in progress sits on top for context.
 */

const POSITIONS: Position[] = ["QB", "RB", "WR", "TE", "K", "DST"];
const POSITION_NAME: Record<Position, string> = {
  QB: "Quarterbacks",
  RB: "Running backs",
  WR: "Wide receivers",
  TE: "Tight ends",
  K: "Kickers",
  DST: "Defenses",
};

const isLive = (p: PortfolioPlayer) =>
  p.liveStatus === "live" || p.liveStatus === "red_zone" || p.liveStatus === "halftime";

/** League pills: green = starting him there, grey = on the bench there. */
function LeaguePills({ contexts, showValues }: { contexts: PlayerLeagueContext[]; showValues: boolean }) {
  return (
    <span className="flex flex-wrap gap-1">
      {contexts.map((c) => (
        <span
          key={c.leagueId}
          className={cn(
            "inline-flex max-w-full items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold leading-tight",
            c.isStarter ? "border-win/35 bg-win/10 text-ink" : "border-edge bg-surface-2 text-ink-faint"
          )}
        >
          {!c.isStarter ? <span className="text-[8px] font-bold tracking-wider">BN</span> : null}
          <span className="truncate">{c.leagueName}</span>
          {showValues ? (
            <span className="tnum font-bold">
              {c.points > 0 ? formatPoints(c.points) : c.projectedPoints ? `p${formatPoints(c.projectedPoints)}` : ""}
            </span>
          ) : null}
        </span>
      ))}
    </span>
  );
}

function gameLabel(p: PortfolioPlayer): React.ReactNode {
  const g = p.game;
  if (!g) return <span className="text-ink-faint">{p.liveStatus === "played" ? "Played" : p.liveStatus === "upcoming" ? "Upcoming" : "Bye"}</span>;
  const opp = g.homeTeam === p.player.nflTeam ? `vs ${g.awayTeam}` : `@ ${g.homeTeam}`;
  if (isLive(p)) {
    return (
      <>
        <LiveIndicator label={gamePhaseLabel(g)} />
        <span>{opp}</span>
        {p.liveStatus === "red_zone" ? <span className="font-bold text-redzone">RED ZONE</span> : null}
      </>
    );
  }
  return (
    <span>
      {opp} · {g.status === "final" ? "Final" : gameKickoffLabel(g)}
    </span>
  );
}

function LineupRow({ p, startersOnly }: { p: PortfolioPlayer; startersOnly: boolean }) {
  const scored = p.stats !== null || p.pointsPerLineup > 0 || p.liveStatus === "final";
  const contexts = startersOnly ? p.leagues.filter((l) => l.isStarter) : p.leagues;
  // Show per-league values only when leagues disagree (different scoring).
  const values = new Set(
    contexts.filter((l) => l.isStarter).map((l) => formatPoints(l.points > 0 ? l.points : (l.projectedPoints ?? 0)))
  );
  const line = statLineText(p.player.position, p.stats);
  return (
    <li className={cn("flex items-center gap-2.5 px-3 py-2", p.liveStatus === "red_zone" && "bg-redzone/5")}>
      <PlayerAvatar player={p.player} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 leading-tight">
          <Link href={`/players/${p.player.id}`} className="truncate text-sm font-bold text-ink hover:text-accent">
            {p.player.fullName}
          </Link>
          <span className="shrink-0 text-[10px] font-semibold text-ink-faint">{p.player.nflTeam}</span>
          {p.player.injury ? (
            <span className="shrink-0 text-[9px] font-bold text-warn">{p.player.injuryLabel}</span>
          ) : null}
        </p>
        <p className="tnum flex flex-wrap items-center gap-x-1.5 text-[11px] leading-tight text-ink-dim">
          {gameLabel(p)}
          {line !== "—" ? <span className="text-ink-faint">· {line}</span> : null}
        </p>
        <LeaguePills contexts={contexts} showValues={values.size > 1} />
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

export default function LivePage() {
  const [startersOnly, setStartersOnly] = useState(true);

  useEffect(() => {
    track("live_viewed");
  }, []);

  return (
    <DataGate>
      {(portfolio, snapshot) => {
        const liveGames = portfolio.games.filter(
          (g) => g.game.status === "live" || g.game.status === "halftime"
        );
        const nextUp = portfolio.games
          .filter((g) => g.game.status === "scheduled")
          .sort((a, b) => a.game.kickoffAt.localeCompare(b.game.kickoffAt))[0]?.game;

        const pool = startersOnly
          ? portfolio.players.filter((p) => p.starterCount > 0)
          : portfolio.players;
        const groups = POSITIONS.map((pos) => {
          const players = pool
            .filter((p) => p.player.position === pos)
            .sort(
              (a, b) =>
                b.pointsPerLineup - a.pointsPerLineup ||
                (b.projectedPerLineup ?? 0) - (a.projectedPerLineup ?? 0) ||
                b.starterCount - a.starterCount
            );
          return { pos, players, total: players.reduce((s, p) => s + p.pointsPerLineup, 0) };
        }).filter((g) => g.players.length > 0);
        const liveCount = pool.filter(isLive).length;

        return (
          <div className="space-y-4">
            <header className="flex items-center justify-between gap-2">
              <div className="flex items-baseline gap-2">
                <h1 className="text-xl font-black uppercase tracking-wide text-ink">Live</h1>
                <span className="tnum text-xs font-semibold text-ink-faint">
                  Week {snapshot.meta.week} · {pool.length} {startersOnly ? "starters" : "players"}
                  {liveCount > 0 ? ` · ${liveCount} on the field` : ""}
                </span>
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

            {/* Scoreboard: games in progress */}
            {liveGames.length > 0 ? (
              <ul aria-label="Games in progress" className="scroll-thin -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
                {liveGames.map((rg) => (
                  <li key={rg.game.id} className="shrink-0">
                    <Link
                      href={`/games/${rg.game.id}`}
                      className={cn(
                        "block rounded-lg border border-edge bg-surface px-3 py-1.5 transition-colors hover:border-edge-strong",
                        rg.game.redZone && "redzone-glow"
                      )}
                    >
                      <span className="tnum block text-sm font-black leading-tight text-ink">
                        {rg.game.awayTeam} {rg.game.awayScore}
                        <span className="mx-1 font-medium text-ink-faint">@</span>
                        {rg.game.homeTeam} {rg.game.homeScore}
                      </span>
                      <span className="tnum flex items-center gap-1.5 text-[10px] font-semibold text-ink-dim">
                        <LiveIndicator label={gamePhaseLabel(rg.game)} className="text-[10px]" />
                        {rg.starterCount > 0 ? `· ${rg.starterCount} of yours` : null}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-lg border border-dashed border-edge bg-surface px-3 py-2 text-xs font-medium text-ink-dim">
                Nothing on right now.
                {nextUp ? (
                  <span className="tnum">
                    {" "}
                    Next kickoff: <span className="font-bold text-ink">{nextUp.awayTeam} @ {nextUp.homeTeam} · {gameKickoffLabel(nextUp)}</span>
                  </span>
                ) : null}
              </p>
            )}

            {/* Composite lineup */}
            {groups.length === 0 ? (
              <p className="rounded-xl border border-dashed border-edge bg-surface px-4 py-8 text-center text-sm text-ink-dim">
                No players to show.
              </p>
            ) : (
              groups.map((g) => (
                <section key={g.pos} aria-label={POSITION_NAME[g.pos]}>
                  <h2 className="mb-1.5 flex items-center gap-2 text-[11px] font-bold tracking-[0.14em]">
                    <span className={POSITION_TEXT[g.pos]}>{g.pos}</span>
                    <span className="text-ink-faint">{POSITION_NAME[g.pos].toUpperCase()}</span>
                    <span className="tnum text-ink-faint">· {g.players.length}</span>
                    <span className="h-px flex-1 bg-edge" aria-hidden />
                    {g.total > 0 ? (
                      <span className="tnum text-ink-dim">{formatPoints(g.total)} pts</span>
                    ) : null}
                  </h2>
                  <ul className="divide-y divide-edge/60 overflow-hidden rounded-xl border border-edge bg-surface">
                    {g.players.map((p) => (
                      <LineupRow key={p.player.id} p={p} startersOnly={startersOnly} />
                    ))}
                  </ul>
                </section>
              ))
            )}
          </div>
        );
      }}
    </DataGate>
  );
}
