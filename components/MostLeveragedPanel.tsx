"use client";

import Link from "next/link";
import type { PortfolioPlayer } from "@/lib/types";
import { cn, formatPercent, formatPoints } from "@/lib/utils";
import { PlayerAvatar, POSITION_TEXT } from "@/components/PlayerAvatar";

/**
 * "Most leveraged" — the players this week's results ride on the most:
 * ranked by how many lineups you START them in, then by projected impact.
 * Recomputed from the current week's starters every week, so the list
 * refreshes itself as lineups change.
 */
export function MostLeveragedPanel({
  players,
  week,
  className,
}: {
  players: PortfolioPlayer[];
  week: number;
  className?: string;
}) {
  const leveraged = players
    .filter((p) => p.starterCount > 0)
    .slice()
    .sort(
      (a, b) =>
        b.starterCount - a.starterCount ||
        b.projectedImpact - a.projectedImpact ||
        b.portfolioImpact - a.portfolioImpact
    )
    .slice(0, 6);

  if (leveraged.length === 0) return null;

  return (
    <section aria-label="Most leveraged players" className={className}>
      <h2 className="mb-1.5 text-[11px] font-bold tracking-[0.14em] text-ink-faint">
        MOST LEVERAGED · WEEK {week}
      </h2>
      <ol className="divide-y divide-edge overflow-hidden rounded-xl border border-edge bg-surface">
        {leveraged.map((p) => {
          const played = p.portfolioImpact > 0;
          return (
            <li key={p.player.id}>
              <Link
                href={`/players/${p.player.id}`}
                className="flex items-center gap-2.5 px-3 py-2 transition-colors hover:bg-surface-2/60"
              >
                <PlayerAvatar player={p.player} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-ink">
                    {p.player.fullName}
                  </span>
                  <span className="tnum block truncate text-[11px] text-ink-dim">
                    <span className={cn("font-bold", POSITION_TEXT[p.player.position])}>
                      {p.player.position}
                    </span>
                    {" · "}
                    {p.player.nflTeam}
                    {" · "}
                    {formatPercent(p.starterExposure)} of your lineups
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="tnum block text-sm font-black leading-tight text-ink">
                    START ×{p.starterCount}
                  </span>
                  <span className="tnum block text-[10px] leading-tight text-ink-faint">
                    {played
                      ? `${formatPoints(p.portfolioImpact)} pts across lineups`
                      : p.projectedImpact > 0
                        ? `proj ${formatPoints(p.projectedImpact)} across lineups`
                        : `of ${p.totalLeagues} leagues`}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
