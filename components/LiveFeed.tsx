"use client";

import Link from "next/link";
import type { AlertType, PortfolioAlert } from "@/lib/types";
import { cn, formatSigned, timeAgo } from "@/lib/utils";
import { EmptyState } from "@/components/ui/states";

const ALERT_META: Record<AlertType, { label: string; cls: string; accent: string }> = {
  touchdown: { label: "TOUCHDOWN", cls: "text-win border-win/40 bg-win/10", accent: "border-l-win" },
  red_zone: { label: "RED ZONE", cls: "text-redzone border-redzone/50 bg-redzone/10", accent: "border-l-redzone" },
  big_play: { label: "BIG PLAY", cls: "text-accent border-accent/40 bg-accent/10", accent: "border-l-accent" },
  game_start: { label: "GAME START", cls: "text-ink-dim border-edge bg-surface-2", accent: "border-l-edge-strong" },
  game_final: { label: "GAME FINAL", cls: "text-ink-dim border-edge bg-surface-2", accent: "border-l-edge-strong" },
  player_milestone: { label: "MILESTONE", cls: "text-warn border-warn/40 bg-warn/10", accent: "border-l-warn" },
  fantasy_lead_change: { label: "LEAD CHANGE", cls: "text-warn border-warn/40 bg-warn/10", accent: "border-l-warn" },
  stat_update: { label: "UPDATE", cls: "text-ink-dim border-edge bg-surface-2", accent: "border-l-edge-strong" },
};

export function AlertCard({ alert, className }: { alert: PortfolioAlert; className?: string }) {
  const meta = ALERT_META[alert.type];
  const starters = alert.leagueImpacts.filter((l) => l.isStarter);
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            "rounded border px-1.5 py-0.5 text-[9px] font-bold tracking-wider",
            meta.cls
          )}
        >
          {meta.label}
        </span>
        <time dateTime={alert.at} className="tnum text-[10px] text-ink-faint">
          {timeAgo(alert.at)}
        </time>
      </div>
      <p className="mt-1.5 text-sm font-semibold text-ink">{alert.headline}</p>
      {alert.detail ? <p className="tnum text-xs text-ink-dim">{alert.detail}</p> : null}
      {alert.leagueImpacts.length > 0 ? (
        <div className="mt-1.5 space-y-0.5">
          {alert.leagueImpacts.some((l) => l.points !== 0) ? (
            alert.leagueImpacts.map((l) => (
              <p key={l.leagueId} className="tnum text-[11px] text-ink-dim">
                {l.points !== 0 ? (
                  <span className={cn("font-bold", l.isStarter ? "text-win" : "text-ink-faint")}>
                    {formatSigned(l.points)}
                  </span>
                ) : null}{" "}
                {l.leagueName}
                {!l.isStarter ? <span className="text-ink-faint"> · bench</span> : null}
              </p>
            ))
          ) : (
            <p className="tnum text-[11px] text-ink-dim">
              Owned in {alert.leagueImpacts.length} league{alert.leagueImpacts.length === 1 ? "" : "s"} ·
              starting in {starters.length}
            </p>
          )}
          {alert.portfolioImpact !== null && alert.portfolioImpact !== 0 ? (
            <p className="tnum text-[11px] font-bold text-win">
              {formatSigned(alert.portfolioImpact)} portfolio impact
            </p>
          ) : null}
        </div>
      ) : null}
    </>
  );

  // Left accent stripe color-codes the alert type for fast scanning.
  const cls = cn(
    "block rounded-lg border border-edge border-l-2 bg-surface p-3 transition-colors",
    meta.accent,
    alert.playerId && "hover:border-edge-strong",
    className
  );
  return alert.playerId ? (
    <Link href={`/players/${alert.playerId}`} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export function LiveFeed({
  alerts,
  limit,
  className,
}: {
  alerts: PortfolioAlert[];
  limit?: number;
  className?: string;
}) {
  const shown = limit ? alerts.slice(0, limit) : alerts;
  if (shown.length === 0) {
    return (
      <EmptyState
        title="No live activity yet"
        message="Alerts about touchdowns, red-zone trips and big plays from your players will appear here."
        className={className}
      />
    );
  }
  return (
    // Polling refreshes are frequent — keep screen readers quiet (off) and
    // let users read the feed on their own terms.
    <ol aria-live="off" className={cn("space-y-2", className)}>
      {shown.map((a) => (
        <li key={a.id}>
          <AlertCard alert={a} />
        </li>
      ))}
    </ol>
  );
}
