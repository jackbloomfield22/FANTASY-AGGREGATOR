"use client";

import Link from "next/link";
import type { PortfolioPlayer } from "@/lib/types";
import { cn, formatPoints, formatSigned, gamePhaseLabel, kickoffLabel } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/badges";
import { statLineText } from "@/components/PlayerStatLine";
import { LeagueChip } from "@/components/LeagueChip";
import { MiniFootballField } from "@/components/MiniFootballField";

/**
 * Full-width, column-aligned player row for the Players page.
 *
 * One row = one canonical player. Columns line up across rows so the list
 * scans like a scoreboard: WHO | GAME | DOING | WHERE YOU OWN HIM | IMPACT.
 */

const GRID =
  "md:grid md:grid-cols-[minmax(160px,210px)_170px_minmax(170px,1fr)_minmax(200px,1fr)_150px] md:items-center md:gap-x-5";

export function PlayerListHeader() {
  return (
    <div
      aria-hidden
      className={cn(
        GRID,
        "hidden border-b border-edge px-4 pb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-ink-faint"
      )}
    >
      <span>Player</span>
      <span>Game</span>
      <span>Live stats</span>
      <span>Your leagues</span>
      <span className="text-right">Portfolio</span>
    </div>
  );
}

/** 5-dot exposure meter: filled = leagues where the condition holds. */
function ExposureDots({
  label,
  count,
  total,
  tone,
  title,
}: {
  label: string;
  count: number;
  total: number;
  tone: "win" | "dim";
  title: string;
}) {
  return (
    <span className="flex items-center justify-end gap-1.5" title={title}>
      <span className="text-[9px] font-bold tracking-wider text-ink-faint">{label}</span>
      {total <= 8 ? (
        <span className="flex gap-[3px]" aria-hidden>
          {Array.from({ length: total }).map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                i < count ? (tone === "win" ? "bg-win" : "bg-ink-dim") : "bg-surface-3"
              )}
            />
          ))}
        </span>
      ) : null}
      <span className="tnum text-[11px] font-bold text-ink">
        {count}/{total}
      </span>
    </span>
  );
}

export function PlayerListRow({
  player,
  compact = false,
  className,
}: {
  player: PortfolioPlayer;
  compact?: boolean;
  className?: string;
}) {
  const { player: p, game } = player;
  const isRedZone = player.liveStatus === "red_zone";
  const isLive = isRedZone || player.liveStatus === "live" || player.liveStatus === "halftime";
  const hasBall = game && isLive && game.possessionTeam === p.nflTeam;
  const opponent = game ? (game.homeTeam === p.nflTeam ? `vs ${game.awayTeam}` : `@ ${game.homeTeam}`) : null;

  return (
    <article
      className={cn(
        "relative rounded-lg border border-edge bg-surface px-4 transition-colors hover:border-edge-strong",
        compact ? "py-2" : "py-3",
        isRedZone && "redzone-glow",
        className
      )}
    >
      <div className={cn(GRID, "flex flex-col gap-2")}>
        {/* WHO */}
        <div className="flex items-center justify-between gap-2 md:block">
          <div className="min-w-0">
            <Link
              href={`/players/${p.id}`}
              className="block truncate text-sm font-bold text-ink hover:text-accent"
            >
              {p.fullName}
              <span className="absolute inset-0" aria-hidden />
            </Link>
            <p className="text-[11px] font-medium text-ink-dim">
              {p.position} · {p.nflTeam}
              {opponent ? <span className="text-ink-faint"> {opponent}</span> : null}
            </p>
          </div>
          {/* status shows here on mobile, in the game column on desktop */}
          <StatusBadge status={player.liveStatus} className="md:hidden" />
        </div>

        {/* GAME */}
        <div className="min-w-0">
          <div className="mb-0.5 flex items-center gap-1.5">
            <StatusBadge status={player.liveStatus} className="hidden md:inline-flex" />
            <span className="tnum truncate text-[11px] font-medium text-ink-dim">
              {game
                ? game.status === "scheduled"
                  ? kickoffLabel(game.kickoffAt)
                  : game.status === "live"
                    ? gamePhaseLabel(game) // the badge already says FINAL / HALF
                    : ""
                : "No game this week"}
            </span>
          </div>
          {game && game.status !== "scheduled" ? (
            <p className="tnum whitespace-nowrap text-sm font-bold leading-tight text-ink">
              {game.awayTeam} {game.awayScore}
              <span className="mx-1 text-ink-faint">—</span>
              {game.homeTeam} {game.homeScore}
            </p>
          ) : null}
          {hasBall ? (
            <p className={cn("text-[10px] font-bold tracking-wide", isRedZone ? "text-redzone" : "text-ink-dim")}>
              {p.nflTeam} BALL{isRedZone ? " · RED ZONE" : ""}
            </p>
          ) : null}
        </div>

        {/* DOING */}
        <div className="min-w-0">
          <p className="tnum truncate text-xs font-medium text-ink" title={statLineText(p.position, player.stats)}>
            {statLineText(p.position, player.stats)}
          </p>
          {!compact && isRedZone && game ? (
            <MiniFootballField game={game} compact className="mt-1.5 max-w-[280px]" />
          ) : null}
        </div>

        {/* WHERE YOU OWN HIM */}
        <div className="relative z-10 flex flex-wrap items-center gap-1.5">
          {compact ? (
            <span className="text-[11px] font-medium text-ink-dim">
              {player.starterCount > 0 ? `Starting ×${player.starterCount}` : "Bench only"}
              {player.rosteredCount > player.starterCount
                ? ` · Bench ×${player.rosteredCount - player.starterCount}`
                : ""}
            </span>
          ) : (
            player.leagues.map((ctx) => <LeagueChip key={ctx.leagueId} context={ctx} />)
          )}
        </div>

        {/* IMPACT */}
        <div className="flex items-center justify-between gap-3 md:block md:text-right">
          <div>
            <p
              className={cn(
                "tnum text-lg font-black leading-none",
                player.portfolioImpact > 0 ? "text-win" : "text-ink-faint"
              )}
              title="Portfolio Impact — the fantasy points this player has generated across every lineup where you're starting him this week."
            >
              {player.portfolioImpact === 0 && player.liveStatus === "upcoming"
                ? "—"
                : formatSigned(player.portfolioImpact)}
            </p>
            {player.benchPoints > 0 ? (
              <p
                className="tnum text-[10px] font-medium text-ink-faint"
                title="Points scored in leagues where he's on your bench (not counted above)."
              >
                bench {formatPoints(player.benchPoints)}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col gap-0.5 md:mt-1">
            <ExposureDots
              label="START"
              count={player.starterCount}
              total={player.totalLeagues}
              tone="win"
              title="Starter Exposure — leagues where this player is in your starting lineup."
            />
            <ExposureDots
              label="OWN"
              count={player.rosteredCount}
              total={player.totalLeagues}
              tone="dim"
              title="Roster Exposure — leagues where you roster this player."
            />
          </div>
        </div>
      </div>
    </article>
  );
}
