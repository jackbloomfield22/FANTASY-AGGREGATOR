"use client";

import { use, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DataGate } from "@/components/DataGate";
import { StatusBadge, ExposureBadge, StatPill } from "@/components/ui/badges";
import { EmptyState } from "@/components/ui/states";
import { MiniFootballField } from "@/components/MiniFootballField";
import { PlayerStatLine } from "@/components/PlayerStatLine";
import { PlayerAvatar, POSITION_TEXT } from "@/components/PlayerAvatar";
import { scoringLabel } from "@/lib/scoring/engine";
import { playerLiveStatus } from "@/lib/portfolio/aggregate";
import {
  cn,
  downDistanceLabel,
  fieldPositionLabel,
  formatPercent,
  formatPoints,
  formatSigned,
  gamePhaseLabel,
} from "@/lib/utils";
import { track } from "@/lib/analytics";
import type { NormalizedNFLGame, RawStatLine } from "@/lib/types";

const STAT_ROWS: { key: keyof RawStatLine; label: string }[] = [
  { key: "pass_cmp", label: "Completions" },
  { key: "pass_att", label: "Pass attempts" },
  { key: "pass_yd", label: "Passing yards" },
  { key: "pass_td", label: "Passing TD" },
  { key: "pass_int", label: "Interceptions" },
  { key: "rush_att", label: "Carries" },
  { key: "rush_yd", label: "Rushing yards" },
  { key: "rush_td", label: "Rushing TD" },
  { key: "rec_tgt", label: "Targets" },
  { key: "rec", label: "Receptions" },
  { key: "rec_yd", label: "Receiving yards" },
  { key: "rec_td", label: "Receiving TD" },
  { key: "fum_lost", label: "Fumbles lost" },
  { key: "xpm", label: "XP made" },
  { key: "fgm_20_29", label: "FG 20-29" },
  { key: "fgm_30_39", label: "FG 30-39" },
  { key: "fgm_40_49", label: "FG 40-49" },
  { key: "fgm_50p", label: "FG 50+" },
];

function GamePanel({ game }: { game: NormalizedNFLGame }) {
  const fieldPos = fieldPositionLabel(game);
  const downDist = downDistanceLabel(game);
  return (
    <section aria-label="Live game" className="rounded-xl border border-edge bg-surface p-4">
      <div className="flex items-center justify-between">
        <p className="tnum text-xl font-black text-ink">
          {game.awayTeam} {game.status === "scheduled" ? "" : game.awayScore}
          <span className="mx-2 text-ink-faint">—</span>
          {game.homeTeam} {game.status === "scheduled" ? "" : game.homeScore}
        </p>
        <p className="tnum text-sm font-semibold text-ink-dim">{gamePhaseLabel(game)}</p>
      </div>
      {game.possessionTeam ? (
        <p className="tnum mt-1 text-xs font-semibold text-ink-dim">
          {game.possessionTeam} ball{fieldPos ? ` · ${fieldPos}` : ""}
          {downDist ? ` · ${downDist}` : ""}
          {game.driveSummary ? ` · ${game.driveSummary}` : ""}
          {game.redZone ? <span className="ml-1.5 font-bold text-redzone">RED ZONE</span> : null}
        </p>
      ) : null}
      {game.ballYardLine !== null ? <MiniFootballField game={game} className="mt-3" /> : null}
    </section>
  );
}

export default function PlayerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  useEffect(() => {
    track("player_opened", { id });
  }, [id]);

  return (
    <DataGate>
      {(portfolio, snapshot) => {
        const owned = portfolio.players.find((p) => p.player.id === id);
        const rawPlayer = owned?.player ?? snapshot.players.find((p) => p.id === id);

        if (!rawPlayer) {
          return (
            <EmptyState
              title="Player not found"
              message="This player isn't part of your current portfolio."
              action={
                <Link href="/players" className="text-sm font-semibold text-accent hover:underline">
                  Back to players
                </Link>
              }
            />
          );
        }

        const game =
          owned?.game ??
          snapshot.games.find(
            (g) => g.homeTeam === rawPlayer.nflTeam || g.awayTeam === rawPlayer.nflTeam
          ) ??
          null;
        const stats =
          owned?.stats ?? snapshot.playerStats.find((s) => s.playerId === rawPlayer.id)?.stats ?? null;
        const liveStatus =
          owned?.liveStatus ??
          playerLiveStatus(game, rawPlayer, {
            hasSchedule: snapshot.games.length > 0,
            hasStats: stats !== null,
          });
        const opponent = game
          ? game.homeTeam === rawPlayer.nflTeam
            ? `vs ${game.awayTeam}`
            : `@ ${game.homeTeam}`
          : null;
        const visibleStatRows = STAT_ROWS.filter((r) => (stats?.[r.key] ?? 0) !== 0);

        return (
          <div className="space-y-4">
            <Link
              href="/players"
              className="inline-flex items-center gap-1 text-xs font-semibold text-ink-dim hover:text-ink"
            >
              <ArrowLeft size={14} aria-hidden /> Players
            </Link>

            <header className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex items-center gap-3">
                <PlayerAvatar player={rawPlayer} size="lg" />
                <div>
                  <h1 className="text-2xl font-black uppercase tracking-wide text-ink">
                    {rawPlayer.fullName}
                  </h1>
                  <p className="text-sm font-medium text-ink-dim">
                    <span className={cn("font-bold", POSITION_TEXT[rawPlayer.position])}>
                      {rawPlayer.position}
                    </span>{" "}
                    · {rawPlayer.nflTeam}
                    {opponent ? ` · ${opponent}` : ""}
                    {game ? ` · ${gamePhaseLabel(game)}` : ""}
                  </p>
                </div>
              </div>
              <StatusBadge status={liveStatus} />
            </header>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-4">
                <section aria-label="Live stats" className="rounded-xl border border-edge bg-surface p-4">
                  <h2 className="mb-2 text-[11px] font-bold tracking-[0.14em] text-ink-faint">
                    LIVE STATS
                  </h2>
                  <PlayerStatLine position={rawPlayer.position} stats={stats} className="mb-3 text-sm" />
                  {visibleStatRows.length > 0 ? (
                    <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 sm:grid-cols-3">
                      {visibleStatRows.map((r) => (
                        <div key={String(r.key)} className="flex items-baseline justify-between gap-2">
                          <dt className="text-[11px] text-ink-faint">{r.label}</dt>
                          <dd className="tnum text-sm font-bold text-ink">{stats?.[r.key]}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <p className="text-sm text-ink-dim">
                      {liveStatus === "upcoming" ? "Game hasn't started yet." : "No stats recorded."}
                    </p>
                  )}
                </section>

                {game ? <GamePanel game={game} /> : null}
              </div>

              <section aria-label="Portfolio exposure" className="rounded-xl border border-edge bg-surface p-4">
                <h2 className="mb-2 text-[11px] font-bold tracking-[0.14em] text-ink-faint">
                  PORTFOLIO EXPOSURE
                </h2>
                {owned ? (
                  <>
                    <p className="text-sm font-semibold text-ink">
                      Owned in {owned.rosteredCount} of {owned.totalLeagues} leagues
                    </p>
                    <p className="tnum mt-0.5 text-xs text-ink-dim">
                      Roster exposure {formatPercent(owned.rosterExposure)} · Starter exposure{" "}
                      {formatPercent(owned.starterExposure)}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <StatPill
                        label="Portfolio"
                        value={formatSigned(owned.portfolioImpact)}
                        tone={owned.portfolioImpact > 0 ? "win" : "default"}
                        title="Portfolio Impact — the fantasy points this player has generated across every lineup where you're starting him this week."
                      />
                      {owned.benchPoints > 0 ? (
                        <StatPill label="Bench pts" value={formatPoints(owned.benchPoints)} />
                      ) : null}
                      <ExposureBadge count={owned.rosteredCount} total={owned.totalLeagues} kind="roster" />
                      <ExposureBadge count={owned.starterCount} total={owned.totalLeagues} kind="starter" />
                    </div>
                    <ul className="mt-4 space-y-2">
                      {owned.leagues.map((ctx) => (
                        <li
                          key={ctx.leagueId}
                          className={cn(
                            "flex items-center justify-between gap-2 rounded-lg border px-3 py-2",
                            ctx.isStarter ? "border-win/30 bg-win/5" : "border-edge bg-surface-2"
                          )}
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-ink">{ctx.leagueName}</p>
                            <p className="text-[11px] text-ink-faint">
                              {scoringLabel(ctx.scoringType)} · slot {ctx.slot}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <span
                              className={cn(
                                "rounded border px-1.5 py-0.5 text-[9px] font-bold tracking-wider",
                                ctx.isStarter
                                  ? "border-win/40 bg-win/10 text-win"
                                  : "border-edge bg-surface-3 text-ink-faint"
                              )}
                            >
                              {ctx.isStarter ? "STARTING" : "BENCH"}
                            </span>
                            {ctx.points === 0 && ctx.projectedPoints ? (
                              <span className="tnum text-sm font-medium text-ink-faint">
                                proj {formatPoints(ctx.projectedPoints)}
                              </span>
                            ) : (
                              <span className="tnum text-sm font-bold text-ink">
                                {formatPoints(ctx.points)} pts
                              </span>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="text-sm text-ink-dim">
                    You don&apos;t roster this player — shown here from a matchup you&apos;re playing
                    against.
                  </p>
                )}
              </section>
            </div>
          </div>
        );
      }}
    </DataGate>
  );
}
