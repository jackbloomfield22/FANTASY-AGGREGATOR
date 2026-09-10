"use client";

import { useState } from "react";
import type { PlayerLeagueContext } from "@/lib/types";
import { scoringLabel } from "@/lib/scoring/engine";
import { cn, formatPoints } from "@/lib/utils";

/**
 * "START · League A · 22.4" chip. Clicking reveals league-specific context
 * (scoring format, slot) inline. Scoring differences between leagues are
 * shown, never hidden.
 */
export function LeagueChip({ context, className }: { context: PlayerLeagueContext; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setOpen((o) => !o);
      }}
      aria-expanded={open}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors",
        context.isStarter
          ? "border-win/35 bg-win/10 text-ink hover:bg-win/15"
          : "border-edge bg-surface-2 text-ink-dim hover:bg-surface-3",
        className
      )}
    >
      <span
        className={cn(
          "text-[9px] font-bold tracking-wider",
          context.isStarter ? "text-win" : "text-ink-faint"
        )}
      >
        {context.isStarter ? "START" : "BENCH"}
      </span>
      <span className="max-w-[9rem] truncate">{context.leagueName}</span>
      {context.points === 0 && context.projectedPoints ? (
        <span className="tnum font-medium text-ink-faint">proj {formatPoints(context.projectedPoints)}</span>
      ) : (
        <span className="tnum font-bold text-ink">{formatPoints(context.points)}</span>
      )}
      {open ? (
        <span className="tnum text-[10px] text-ink-faint">
          {scoringLabel(context.scoringType)} · {context.slot}
        </span>
      ) : null}
    </button>
  );
}

/**
 * Non-interactive league chips — same "what he adds in each league" story,
 * but plain spans so they can live inside a Link (homepage leaderboard,
 * leverage list) without nesting interactive elements.
 */
export function LeagueScoreChips({
  contexts,
  className,
}: {
  contexts: PlayerLeagueContext[];
  className?: string;
}) {
  return (
    <span className={cn("flex flex-wrap gap-1", className)}>
      {contexts.map((c) => (
        <span
          key={c.leagueId}
          className={cn(
            "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium",
            c.isStarter
              ? "border-win/35 bg-win/10 text-ink"
              : "border-edge bg-surface-2 text-ink-dim"
          )}
        >
          <span
            className={cn(
              "text-[8px] font-bold tracking-wider",
              c.isStarter ? "text-win" : "text-ink-faint"
            )}
          >
            {c.isStarter ? "START" : "BN"}
          </span>
          <span className="max-w-[7.5rem] truncate">{c.leagueName}</span>
          {c.points === 0 && c.projectedPoints ? (
            <span className="tnum text-ink-faint">proj {formatPoints(c.projectedPoints)}</span>
          ) : (
            <span className="tnum font-bold text-ink">{formatPoints(c.points)}</span>
          )}
        </span>
      ))}
    </span>
  );
}
