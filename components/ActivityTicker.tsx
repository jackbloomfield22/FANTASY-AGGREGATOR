"use client";

import Link from "next/link";
import type { AlertType, PortfolioAlert } from "@/lib/types";
import { cn, formatSigned, timeAgo } from "@/lib/utils";

const TYPE_META: Record<AlertType, { label: string; text: string; accent: string }> = {
  touchdown: { label: "TD", text: "text-win", accent: "border-l-win" },
  red_zone: { label: "RED ZONE", text: "text-redzone", accent: "border-l-redzone" },
  big_play: { label: "BIG PLAY", text: "text-accent", accent: "border-l-accent" },
  player_milestone: { label: "MILESTONE", text: "text-warn", accent: "border-l-warn" },
  fantasy_lead_change: { label: "LEAD CHANGE", text: "text-warn", accent: "border-l-warn" },
  game_start: { label: "KICKOFF", text: "text-ink-dim", accent: "border-l-edge-strong" },
  game_final: { label: "FINAL", text: "text-ink-dim", accent: "border-l-edge-strong" },
  stat_update: { label: "UPDATE", text: "text-ink-dim", accent: "border-l-edge-strong" },
};

/**
 * Horizontal live-activity ticker: the latest player events as compact
 * cards, scrolling sideways like a broadcast strip — so the feed and the
 * full player list share one screen.
 */
export function ActivityTicker({
  alerts,
  limit = 10,
  className,
}: {
  alerts: PortfolioAlert[];
  limit?: number;
  className?: string;
}) {
  const shown = alerts.slice(0, limit);
  if (shown.length === 0) return null;

  return (
    <div className={cn("relative", className)}>
      <ul
        aria-label="Live activity"
        className="scroll-thin flex snap-x gap-2 overflow-x-auto pb-1.5"
      >
        {shown.map((a) => {
          const meta = TYPE_META[a.type];
          const starters = a.leagueImpacts.filter((l) => l.isStarter).length;
          const bench = a.leagueImpacts.length - starters;
          const inner = (
            <>
              <div className="flex items-center justify-between gap-2">
                <span className={cn("text-[9px] font-bold tracking-wider", meta.text)}>
                  {meta.label}
                </span>
                <time dateTime={a.at} className="tnum text-[9px] text-ink-faint">
                  {timeAgo(a.at)}
                </time>
              </div>
              <p className="mt-0.5 truncate text-xs font-semibold text-ink" title={a.headline}>
                {a.headline}
              </p>
              <div className="mt-0.5 flex items-center justify-between gap-2">
                <span className="flex items-center gap-1">
                  {starters > 0 ? (
                    <span className="rounded border border-win/40 bg-win/10 px-1 py-px text-[8px] font-bold tracking-wider text-win">
                      START{starters > 1 ? ` ×${starters}` : ""}
                    </span>
                  ) : null}
                  {bench > 0 ? (
                    <span className="rounded border border-edge bg-surface-2 px-1 py-px text-[8px] font-bold tracking-wider text-ink-faint">
                      BENCH{bench > 1 ? ` ×${bench}` : ""}
                    </span>
                  ) : null}
                </span>
                <span className="tnum text-[10px]">
                  {a.portfolioImpact !== null && a.portfolioImpact !== 0 ? (
                    <span className={cn("font-bold", a.portfolioImpact > 0 ? "text-win" : "text-loss")}>
                      {formatSigned(a.portfolioImpact)}
                    </span>
                  ) : (
                    <span className="text-ink-faint">{a.type === "red_zone" ? "watch" : ""}</span>
                  )}
                </span>
              </div>
            </>
          );
          const cls = cn(
            "block w-[230px] shrink-0 snap-start rounded-lg border border-edge border-l-2 bg-surface px-3 py-2 transition-colors",
            meta.accent,
            a.playerId && "hover:border-edge-strong hover:bg-surface-2/60"
          );
          return (
            <li key={a.id} className="shrink-0">
              {a.playerId ? (
                <Link href={`/players/${a.playerId}`} className={cls}>
                  {inner}
                </Link>
              ) : (
                <div className={cls}>{inner}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
