"use client";

import Link from "next/link";
import type { PortfolioPlayer } from "@/lib/types";
import { cn, formatPoints, formatSigned, gamePhaseLabel } from "@/lib/utils";
import { ExposureBadge, StatPill, StatusBadge } from "@/components/ui/badges";
import { PlayerStatLine } from "@/components/PlayerStatLine";
import { LeagueChip } from "@/components/LeagueChip";
import { MiniFootballField } from "@/components/MiniFootballField";

/**
 * The core portfolio player card: one canonical player, all leagues at once.
 */
export function PlayerCard({
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
  const isLive = player.liveStatus === "live" || isRedZone || player.liveStatus === "halftime";

  return (
    <article
      className={cn(
        "relative flex flex-col gap-2.5 rounded-xl border border-edge bg-surface p-3.5 transition-colors hover:border-edge-strong",
        isRedZone && "redzone-glow",
        className
      )}
    >
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            href={`/players/${p.id}`}
            className="text-sm font-bold uppercase tracking-wide text-ink hover:text-accent"
          >
            {p.fullName}
            <span className="absolute inset-0" aria-hidden />
          </Link>
          <p className="text-xs font-medium text-ink-dim">
            {p.position} · {p.nflTeam}
            {game ? (
              <span className="tnum">
                {" "}
                · {game.awayTeam} {game.awayScore} — {game.homeTeam} {game.homeScore} ·{" "}
                {gamePhaseLabel(game)}
              </span>
            ) : null}
          </p>
        </div>
        <StatusBadge status={player.liveStatus} />
      </header>

      {game && isLive && game.possessionTeam === p.nflTeam ? (
        <p className={cn("tnum text-[11px] font-bold tracking-wide", isRedZone ? "text-redzone" : "text-ink-dim")}>
          {p.nflTeam} BALL
          {game.ballYardLine !== null && game.ballYardLine > 50
            ? ` — ${game.possessionTeam === game.homeTeam ? game.awayTeam : game.homeTeam} ${100 - game.ballYardLine}`
            : ""}
          {isRedZone ? " · RED ZONE" : ""}
        </p>
      ) : null}

      <PlayerStatLine position={p.position} stats={player.stats} />

      {!compact && isRedZone && game ? <MiniFootballField game={game} compact /> : null}

      <div className="flex flex-wrap items-center gap-1.5">
        <StatPill
          label="Portfolio"
          value={formatSigned(player.portfolioImpact)}
          tone={player.portfolioImpact > 0 ? "win" : "default"}
          title="Portfolio Impact — the fantasy points this player has generated across every lineup where you're starting him this week."
        />
        {!compact && player.benchPoints > 0 ? (
          <StatPill
            label="Bench"
            value={formatPoints(player.benchPoints)}
            title="Points scored in leagues where this player is on your bench (not counted in Portfolio Impact)."
          />
        ) : null}
        <ExposureBadge count={player.starterCount} total={player.totalLeagues} kind="starter" />
        <ExposureBadge count={player.rosteredCount} total={player.totalLeagues} kind="roster" />
      </div>

      {!compact ? (
        <div className="relative z-10 flex flex-wrap gap-1.5">
          {player.leagues.map((ctx) => (
            <LeagueChip key={ctx.leagueId} context={ctx} />
          ))}
        </div>
      ) : null}
    </article>
  );
}

/** Compact row variant for lineups and game-detail lists. */
export function PlayerRow({
  player,
  right,
  className,
}: {
  player: PortfolioPlayer;
  right?: React.ReactNode;
  className?: string;
}) {
  const { player: p, game } = player;
  return (
    <Link
      href={`/players/${p.id}`}
      className={cn(
        "flex items-center justify-between gap-3 rounded-lg border border-edge bg-surface px-3 py-2 transition-colors hover:border-edge-strong",
        className
      )}
    >
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-ink">
          {p.fullName}
          <span className="ml-1.5 text-xs font-medium text-ink-faint">
            {p.position} · {p.nflTeam}
          </span>
        </p>
        <p className="tnum truncate text-[11px] text-ink-dim">
          {game ? gamePhaseLabel(game) : "No game"} ·{" "}
          <span className="text-ink-dim">
            {player.starterCount > 0 ? `START ×${player.starterCount}` : "BENCH"}
            {player.rosteredCount > player.starterCount && player.starterCount > 0
              ? ` · BENCH ×${player.rosteredCount - player.starterCount}`
              : ""}
          </span>
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {right ?? (
          <span className="tnum text-sm font-bold text-ink">{formatSigned(player.portfolioImpact)}</span>
        )}
        <StatusBadge status={player.liveStatus} />
      </div>
    </Link>
  );
}
