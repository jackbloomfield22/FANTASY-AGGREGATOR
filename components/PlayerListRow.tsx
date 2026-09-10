"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import type { PortfolioPlayer } from "@/lib/types";
import { cn, gamePhaseLabel, kickoffLabel } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/badges";
import { statLineText } from "@/components/PlayerStatLine";
import { LeagueChip } from "@/components/LeagueChip";
import { MiniFootballField } from "@/components/MiniFootballField";
import { PlayerAvatar, POSITION_TEXT } from "@/components/PlayerAvatar";

/**
 * One row per player, with his outcome in EVERY league visible up front:
 *
 *   [ Name · pos/team ]  [ status + game ]  [ stat line + league chips ]
 *
 * Each chip is that league's own scored points (START green / BENCH gray).
 * Tap the row to expand extras (exposure, mini field, detail link).
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

  return (
    <div
      className={cn(
        "rounded-lg border border-edge bg-surface transition-colors",
        open ? "border-edge-strong" : "hover:border-edge-strong",
        isRedZone && "redzone-glow",
        className
      )}
    >
      {/* The expand control is an overlay BUTTON behind the content (valid
          HTML — no interactive elements nested inside it); the player-name
          LINK opts back into pointer events above it. */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={`${open ? "Hide" : "Show"} league details for ${p.fullName}`}
          className="absolute inset-0 h-full w-full cursor-pointer"
        />
        <div className="pointer-events-none relative grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1.5 px-3.5 py-2.5 text-left md:grid-cols-[minmax(170px,220px)_140px_1fr_auto] md:gap-x-4">
        {/* WHO */}
        <span className="flex min-w-0 items-center gap-2.5">
          <PlayerAvatar player={p} size="md" />
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
              <span className={cn("font-bold", POSITION_TEXT[p.position])}>{p.position}</span>
              {" · "}
              {p.nflTeam}
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

        {/* DOING + every league's outcome, always visible */}
        <span className="col-span-2 min-w-0 md:col-span-1">
          <span
            className="tnum mb-1 hidden truncate text-xs font-medium text-ink-dim md:block"
            title={statLineText(p.position, player.stats)}
          >
            {statLineText(p.position, player.stats)}
          </span>
          <span className="pointer-events-auto flex flex-wrap gap-1">
            {player.leagues.map((ctx) => (
              <LeagueChip key={ctx.leagueId} context={ctx} />
            ))}
          </span>
        </span>

        {/* expand control */}
        <span className="col-start-2 row-start-1 flex items-center justify-self-end md:col-start-4 md:row-start-auto">
          <ChevronDown
            size={14}
            aria-hidden
            className={cn("shrink-0 text-ink-faint transition-transform", open && "rotate-180")}
          />
        </span>
        </div>
      </div>

      {open ? (
        <div className="space-y-2.5 border-t border-edge px-3.5 py-3">
          <p className="tnum text-xs font-medium text-ink-dim md:hidden">
            {statLineText(p.position, player.stats)}
          </p>
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
