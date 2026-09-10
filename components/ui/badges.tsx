import type { PlayerLiveStatus, MatchupStatus } from "@/lib/types";
import { cn, formatPercent } from "@/lib/utils";
import type { ReactNode } from "react";

/** Animated live dot + label. */
export function LiveIndicator({ label = "LIVE", className }: { label?: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-live",
        className
      )}
    >
      <span aria-hidden className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-live" />
      {label}
    </span>
  );
}

const PLAYER_STATUS_STYLES: Record<PlayerLiveStatus, { label: string; cls: string; dot?: boolean }> = {
  live: { label: "LIVE", cls: "text-live border-live/40 bg-live/10", dot: true },
  red_zone: { label: "RED ZONE", cls: "text-redzone border-redzone/50 bg-redzone/15", dot: true },
  halftime: { label: "HALF", cls: "text-warn border-warn/40 bg-warn/10" },
  upcoming: { label: "UPCOMING", cls: "text-ink-dim border-edge bg-surface-2" },
  final: { label: "FINAL", cls: "text-ink-faint border-edge bg-surface-2" },
  played: { label: "PLAYED", cls: "text-ink-faint border-edge bg-surface-2" },
  no_game: { label: "BYE", cls: "text-ink-faint border-edge bg-surface-2" },
};

export function StatusBadge({
  status,
  className,
}: {
  status: PlayerLiveStatus;
  className?: string;
}) {
  const s = PLAYER_STATUS_STYLES[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-bold tracking-wider",
        s.cls,
        className
      )}
    >
      {/* static dot — pulsing is reserved for the single header LIVE indicator */}
      {s.dot ? <span aria-hidden className="inline-block h-1 w-1 rounded-full bg-current" /> : null}
      {s.label}
    </span>
  );
}

const MATCHUP_STATUS_STYLES: Record<MatchupStatus, { label: string; cls: string }> = {
  winning: { label: "WINNING", cls: "text-win border-win/40 bg-win/10" },
  losing: { label: "LOSING", cls: "text-loss border-loss/40 bg-loss/10" },
  tossup: { label: "TOSS UP", cls: "text-warn border-warn/40 bg-warn/10" },
  final: { label: "FINAL", cls: "text-ink-faint border-edge bg-surface-2" },
};

export function MatchupStatusBadge({
  status,
  won,
  className,
}: {
  status: MatchupStatus;
  /** for final matchups: did the user win? */
  won?: boolean;
  className?: string;
}) {
  let s = MATCHUP_STATUS_STYLES[status];
  if (status === "final" && won !== undefined) {
    s = won
      ? { label: "WON", cls: "text-win border-win/40 bg-win/10" }
      : { label: "LOST", cls: "text-loss border-loss/40 bg-loss/10" };
  }
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-bold tracking-wider",
        s.cls,
        className
      )}
    >
      {s.label}
    </span>
  );
}

/** Small labeled stat, e.g. label="Portfolio" value="+44.8". */
export function StatPill({
  label,
  value,
  tone = "default",
  className,
  title,
}: {
  label: string;
  value: ReactNode;
  tone?: "default" | "win" | "loss" | "accent";
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-baseline gap-1.5 rounded-md border border-edge bg-surface-2 px-2 py-1",
        className
      )}
    >
      <span className="text-[10px] font-medium uppercase tracking-wider text-ink-faint">{label}</span>
      <span
        className={cn(
          "tnum text-xs font-bold",
          tone === "win" && "text-win",
          tone === "loss" && "text-loss",
          tone === "accent" && "text-accent",
          tone === "default" && "text-ink"
        )}
      >
        {value}
      </span>
    </span>
  );
}

/** "3 / 5 leagues · 60%" exposure chip. */
export function ExposureBadge({
  count,
  total,
  kind,
  className,
}: {
  count: number;
  total: number;
  kind: "roster" | "starter";
  className?: string;
}) {
  const label = kind === "roster" ? "Rostered" : "Starting";
  const title =
    kind === "roster"
      ? "Roster Exposure — the percentage of your leagues where you roster this player."
      : "Starter Exposure — the percentage of your leagues where this player is currently in your starting lineup.";
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-baseline gap-1.5 rounded-md border border-edge bg-surface-2 px-2 py-1",
        className
      )}
    >
      <span className="text-[10px] font-medium uppercase tracking-wider text-ink-faint">{label}</span>
      <span className="tnum text-xs font-bold text-ink">
        {count}/{total}
      </span>
      <span className="tnum text-[10px] text-ink-dim">{formatPercent(total > 0 ? count / total : 0)}</span>
    </span>
  );
}

/** Simple CSS tooltip for term definitions (also sets title for a11y). */
export function TermTip({ term, definition }: { term: string; definition: string }) {
  return (
    <abbr title={definition} className="cursor-help no-underline decoration-dotted">
      {term}
    </abbr>
  );
}
