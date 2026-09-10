"use client";

import Link from "next/link";
import type { MatchupView } from "@/lib/types";
import { cn, formatPoints } from "@/lib/utils";
import { MatchupStatusBadge } from "@/components/ui/badges";

/**
 * All matchups in one horizontal strip: league, score, status, win chance.
 * The fastest possible answer to "am I winning?" — on every screen size.
 */
export function MatchupStrip({
  matchups,
  showRemaining = false,
  className,
}: {
  matchups: MatchupView[];
  /** Show "players left" counts (only meaningful when game data exists). */
  showRemaining?: boolean;
  className?: string;
}) {
  if (matchups.length === 0) return null;
  return (
    <ul className={cn("scroll-thin flex snap-x gap-2 overflow-x-auto pb-1.5", className)}>
      {matchups.map((m) => {
        const { matchup, league, opponentTeam } = m;
        const isFinal = matchup.status === "final";
        const won = matchup.userScore > matchup.opponentScore;
        const ahead = matchup.userScore >= matchup.opponentScore;
        const pct = matchup.winProbability !== null ? Math.round(matchup.winProbability * 100) : null;
        return (
          <li key={matchup.id} className="shrink-0 snap-start">
            <Link
              href={`/teams/${matchup.id}`}
              className="block w-[200px] rounded-lg border border-edge bg-surface px-3 py-2.5 transition-colors hover:border-edge-strong hover:bg-surface-2/60"
            >
              <span className="flex items-center justify-between gap-2">
                <span className="truncate text-[11px] font-semibold text-ink-dim">{league.name}</span>
                <MatchupStatusBadge status={matchup.status} won={isFinal ? won : undefined} />
              </span>
              <span className="tnum mt-1 block text-lg font-black leading-none">
                <span className={ahead ? "text-ink" : "text-ink-dim"}>{formatPoints(matchup.userScore)}</span>
                <span className="mx-1 text-sm text-ink-faint">—</span>
                <span className={!ahead ? "text-ink" : "text-ink-dim"}>{formatPoints(matchup.opponentScore)}</span>
              </span>
              {!isFinal ? (
                <span className="tnum mt-1 flex items-center gap-1 text-[10px] font-semibold text-ink-dim">
                  <span className="rounded border border-edge bg-surface-2 px-1 text-[7px] font-bold tracking-[0.18em] text-ink-faint">
                    PROJ
                  </span>
                  {formatPoints(matchup.userProjected)}
                  <span className="text-ink-faint">—</span>
                  {formatPoints(matchup.opponentProjected)}
                </span>
              ) : null}
              <span className="mt-0.5 flex items-center justify-between gap-2">
                <span className="truncate text-[10px] text-ink-faint">
                  {showRemaining && !isFinal
                    ? `${m.userRemaining} left · ${m.opponentRemaining} left`
                    : `vs ${opponentTeam.name}`}
                </span>
                {!isFinal && pct !== null ? (
                  <span
                    className={cn(
                      "tnum shrink-0 text-[10px] font-bold",
                      pct >= 55 ? "text-win" : pct <= 45 ? "text-loss" : "text-warn"
                    )}
                  >
                    {pct}%
                  </span>
                ) : null}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
