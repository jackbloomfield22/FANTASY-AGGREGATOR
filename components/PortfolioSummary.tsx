"use client";

import type { PortfolioSummary as Summary } from "@/lib/portfolio/aggregate";
import { cn, formatPoints } from "@/lib/utils";
import { LiveIndicator } from "@/components/ui/badges";

function Stat({
  value,
  label,
  tone,
}: {
  value: string | number;
  label: string;
  tone?: "win" | "loss" | "live";
}) {
  return (
    <div className="flex flex-col">
      <span
        className={cn(
          "tnum text-2xl font-black leading-tight",
          tone === "win" && "text-win",
          tone === "loss" && "text-loss",
          tone === "live" && "text-live",
          !tone && "text-ink"
        )}
      >
        {value}
      </span>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-faint">{label}</span>
    </div>
  );
}

/** "YOUR SUNDAY" hero — the whole fantasy day at a glance. */
export function PortfolioSummary({
  summary,
  week,
  className,
}: {
  summary: Summary;
  week: number;
  className?: string;
}) {
  const anyLive = summary.gamesLive > 0;
  return (
    <section
      aria-label="Your Sunday summary"
      className={cn("rounded-xl border border-edge bg-surface p-4 sm:p-5", className)}
    >
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-lg font-black tracking-[0.14em] text-ink">YOUR SUNDAY</h1>
        <div className="flex items-center gap-2 text-[11px] font-semibold text-ink-dim">
          <span>Week {week}</span>
          {anyLive ? <LiveIndicator label={`${summary.gamesLive} LIVE`} /> : <span>No games live</span>}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-x-4 gap-y-3 sm:grid-cols-4 lg:grid-cols-7">
        <Stat value={summary.leagues} label="Leagues" />
        <Stat value={summary.uniquePlayers} label="Unique players" />
        <Stat value={summary.startingSomewhere} label="Starting" />
        <Stat value={summary.liveNow} label="Playing now" tone={summary.liveNow > 0 ? "live" : undefined} />
        <Stat value={summary.projectedWins} label="Proj. wins" tone="win" />
        <Stat value={summary.projectedLosses} label="Proj. losses" tone={summary.projectedLosses > 0 ? "loss" : undefined} />
        <Stat value={formatPoints(summary.totalStartingPoints)} label="Starting pts" />
      </div>
    </section>
  );
}
