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

        <span
          className={cn(
            "tnum text-3xl font-black leading-none",
            matchup.userScore >= matchup.opponentScore ? "text-ink" : "text-ink-dim"
          )}
        >
          {formatPoints(matchup.userScore)}
        </span>
        <span className="px-1 text-xs font-bold text-ink-faint">vs</span>
        <span
          className={cn(
            "tnum text-right text-3xl font-black leading-none",
            matchup.opponentScore >= matchup.userScore ? "text-ink" : "text-ink-dim"
          )}
        >
          {formatPoints(matchup.opponentScore)}
        </span>
      </div>

      <p className="tnum text-[11px] font-medium text-ink-dim">
        Projected: {formatPoints(matchup.userProjected)} — {formatPoints(matchup.opponentProjected)}
        <span className="mx-1.5 text-ink-faint">·</span>
        Remaining — You: {view.userRemaining} · Opp: {view.opponentRemaining}
      </p>

      {!isFinal && matchup.winProbability !== null ? (
        <WinProbability probability={matchup.winProbability} />
      ) : null}
    </article>
  );
}
