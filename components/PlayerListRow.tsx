"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import type { PortfolioPlayer } from "@/lib/types";
import { cn, formatPoints, formatSigned, gamePhaseLabel, kickoffLabel } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/badges";
import { statLineText } from "@/components/PlayerStatLine";
import { LeagueChip } from "@/components/LeagueChip";
import { MiniFootballField } from "@/components/MiniFootballField";

/**
 * One clean line per player, built to answer two questions at a glance:
 * is he playing right now, and how many points is he getting me?
 *
 *   [ Name · pos/team ]  [ status + game ]  [ stat line ]  [ POINTS ]
 *
 * Tap the row to expand per-league detail (chips, exposure, mini field).
 * The name itself links to the full player page.
 */
export function PlayerListRow({
  player,
  className,
}: {
  player: PortfolioPlayer;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const { player: p, game } = player;
  const isRedZone = player.liveStatus === "red_zone";
  const isLive = isRedZone || player.liveStatus === "live" || player.liveStatus === "halftime";
  const hasBall = game && isLive && game.possessionTeam === p.nflTeam;
  const opponent = game ? (game.homeTeam === p.nflTeam ? `vs ${game.awayTeam}` : `@ ${game.homeTeam}`) : null;
  const showDash = player.portfolioImpact === 0 && player.benchPoints === 0 && !isLive && player.liveStatus !== "final";

  return (
    <div
      className={cn(
        "rounded-lg border border-edge bg-surface transition-colors",
        open ? "border-edge-strong" : "hover:border-edge-strong",
        isRedZone && "redzone-glow",
        className
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="grid w-full grid-cols-[1fr_auto] items-center gap-x-3 px-3.5 py-2.5 text-left md:grid-cols-[minmax(170px,230px)_150px_1fr_auto] md:gap-x-5"
      >
        {/* WHO */}
        <span className="min-w-0">
          <span className="flex items-center gap-1.5">
            <Link
              href={`/players/${p.id}`}
              onClick={(e) => e.stopPropagation()}
              className="truncate text-sm font-bold text-ink hover:text-accent"
            >
              {p.fullName}
            </Link>
            {player.starterCount > 0 ? (
              <span className="shrink-0 rounded border border-win/40 bg-win/10 px-1 py-px text-[8px] font-bold tracking-wider text-win">
                START{player.starterCount > 1 ? ` ×${player.starterCount}` : ""}
              </span>
            ) : (
              <span className="shrink-0 rounded border border-edge bg-surface-2 px-1 py-px text-[8px] font-bold tracking-wider text-ink-faint">
                BENCH
              </span>
            )}
          </span>
          <span className="block truncate text-[11px] font-medium text-ink-dim">
            {p.position} · {p.nflTeam}
            {opponent ? ` ${opponent}` : ""}
            <span className="md:hidden">
              {game
                ? ` · ${game.status === "scheduled" ? kickoffLabel(game.kickoffAt) : gamePhaseLabel(game)}`
                : ""}
              {isRedZone ? " · " : ""}
              {isRedZone ? <span className="font-bold text-redzone">RED ZONE</span> : null}
            </span>
          </span>
        </span>

        {/* GAME (desktop) */}
        <span className="hidden min-w-0 md:block">
          <span className="flex items-center gap-1.5">
            <StatusBadge status={player.liveStatus} />
            <span className="tnum truncate text-[11px] font-medium text-ink-dim">
              {game
                ? game.status === "scheduled"
                  ? kickoffLabel(game.kickoffAt)
                  : game.status === "live"
                    ? gamePhaseLabel(game)
                    : ""
                : "No game"}
            </span>
          </span>
          {game && game.status !== "scheduled" ? (
            <span className="tnum block whitespace-nowrap text-xs font-bold leading-tight text-ink">
              {game.awayTeam} {game.awayScore}
              <span className="mx-1 text-ink-faint">—</span>
              {game.homeTeam} {game.homeScore}
              {hasBall ? (
                <span className={cn("ml-1.5 text-[9px] font-bold tracking-wide", isRedZone ? "text-redzone" : "text-ink-dim")}>
                  BALL
                </span>
              ) : null}
            </span>
          ) : null}
        </span>

        {/* DOING (desktop) */}
        <span
          className="tnum hidden truncate text-xs font-medium text-ink-dim md:block"
          title={statLineText(p.position, player.stats)}
        >
          {statLineText(p.position, player.stats)}
        </span>

        {/* POINTS */}
        <span className="flex items-center gap-2 justify-self-end">
          <span className="text-right">
            <span
              className={cn(
                "tnum block text-lg font-black leading-none",
                player.portfolioImpact > 0 ? "text-win" : "text-ink-faint"
              )}
              title="Portfolio Impact — points this player is scoring you across every lineup where he starts."
            >
              {showDash ? "—" : formatSigned(player.portfolioImpact)}
            </span>
            {player.benchPoints > 0 ? (
              <span className="tnum block text-[9px] font-medium text-ink-faint">
                +{formatPoints(player.benchPoints)} bench
              </span>
            ) : null}
          </span>
          <ChevronDown
            size={14}
            aria-hidden
            className={cn("shrink-0 text-ink-faint transition-transform", open && "rotate-180")}
          />
        </span>
      </button>

      {open ? (
        <div className="space-y-2.5 border-t border-edge px-3.5 py-3">
          <p className="tnum text-xs font-medium text-ink-dim md:hidden">
            {statLineText(p.position, player.stats)}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {player.leagues.map((ctx) => (
              <LeagueChip key={ctx.leagueId} context={ctx} />
            ))}
          </div>
          <p className="tnum text-[11px] text-ink-faint">
            Starting in {player.starterCount} of {player.totalLeagues} leagues · rostered in{" "}
            {player.rosteredCount} of {player.totalLeagues}
          </p>
          {isLive && game && game.ballYardLine !== null ? (
            <MiniFootballField game={game} compact className="max-w-[320px]" />
          ) : null}
          <Link
            href={`/players/${p.id}`}
            className="inline-block text-[11px] font-semibold text-accent hover:underline"
          >
            Full player detail →
          </Link>
        </div>
      ) : null}
    </div>
  );
}
