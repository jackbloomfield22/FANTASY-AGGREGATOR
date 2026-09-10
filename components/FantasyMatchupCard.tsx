"use client";

import Link from "next/link";
import type { MatchupView } from "@/lib/types";
import { cn, formatPoints } from "@/lib/utils";
import { MatchupStatusBadge } from "@/components/ui/badges";

/** Win-probability bar with accessible text. */
export function WinProbability({ probability, className }: { probability: number; className?: string }) {
  const pct = Math.round(probability * 100);
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        role="meter"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Win probability"
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3"
      >
        <div
          className={cn("h-full rounded-full", pct >= 55 ? "bg-win" : pct <= 45 ? "bg-loss" : "bg-warn")}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={cn("tnum text-xs font-bold", pct >= 55 ? "text-win" : pct <= 45 ? "text-loss" : "text-warn")}>
        {pct}% win
      </span>
    </div>
  );
}

/**
 * One team's score, stacked on two clearly-labeled lines:
 *   NOW   — points already on the board (big)
 *   PROJ  — where the lineup is projected to land (dim, with players left)
 * plus a thin "pace" bar showing how much of the projection is banked.
 */
export function ScoreStack({
  score,
  projected,
  remaining,
  leading,
  align = "left",
  size = "md",
}: {
  score: number;
  projected: number;
  remaining: number;
  leading: boolean;
  align?: "left" | "right";
  size?: "md" | "lg";
}) {
  const right = align === "right";
  const pct = projected > 0 ? Math.min(100, Math.round((score / projected) * 100)) : score > 0 ? 100 : 0;
  return (
    <div className={cn("min-w-0", right && "text-right")}>
      <p className={cn("flex items-baseline gap-1.5", right && "flex-row-reverse")}>
        <span className="text-[8px] font-bold tracking-[0.18em] text-ink-faint">NOW</span>
        <span
          className={cn(
            "tnum font-black leading-none",
            size === "lg" ? "text-4xl" : "text-3xl",
            leading ? "text-ink" : "text-ink-dim"
          )}
        >
          {formatPoints(score)}
        </span>
      </p>
      <p className={cn("mt-1.5 flex items-baseline gap-1.5", right && "flex-row-reverse")}>
        <span className="rounded border border-edge bg-surface-2 px-1 py-px text-[8px] font-bold tracking-[0.18em] text-ink-faint">
          PROJ
        </span>
        <span className="tnum text-sm font-bold text-ink-dim">{formatPoints(projected)}</span>
        {remaining > 0 ? (
          <span className="tnum text-[9px] font-medium text-ink-faint">{remaining} to play</span>
        ) : null}
      </p>
      <div
        className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-3"
        role="meter"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${pct}% of projected points scored`}
      >
        <div
          className={cn("h-full rounded-full", leading ? "bg-win" : "bg-ink-faint/40", right && "ml-auto")}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function FantasyMatchupCard({ view, className }: { view: MatchupView; className?: string }) {
  const { matchup, league, userTeam, opponentTeam } = view;
  const isFinal = matchup.status === "final";
  const won = matchup.userScore > matchup.opponentScore;

  return (
    <article
      className={cn(
        "relative flex flex-col gap-3 rounded-xl border border-edge bg-surface p-4 transition-colors hover:border-edge-strong",
        className
      )}
    >
      <header className="flex items-center justify-between gap-2">
        <Link
          href={`/teams/${matchup.id}`}
          className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-faint hover:text-accent"
        >
          {league.name}
          <span className="absolute inset-0" aria-hidden />
        </Link>
        <MatchupStatusBadge status={matchup.status} won={isFinal ? won : undefined} />
      </header>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-ink">{userTeam.name}</p>
          <p className="text-[11px] text-ink-faint">You</p>
        </div>
        <div />
        <div className="min-w-0 text-right">
          <p className="truncate text-sm font-bold text-ink">{opponentTeam.name}</p>
          <p className="text-[11px] text-ink-faint">{opponentTeam.ownerName}</p>
        </div>

        <ScoreStack
          score={matchup.userScore}
          projected={matchup.userProjected}
          remaining={view.userRemaining}
          leading={matchup.userScore >= matchup.opponentScore}
        />
        <span className="px-1 text-xs font-bold text-ink-faint">vs</span>
        <ScoreStack
          score={matchup.opponentScore}
          projected={matchup.opponentProjected}
          remaining={view.opponentRemaining}
          leading={matchup.opponentScore >= matchup.userScore}
          align="right"
        />
      </div>

      {!isFinal && matchup.winProbability !== null ? (
        <WinProbability probability={matchup.winProbability} />
      ) : null}
    </article>
  );
}
