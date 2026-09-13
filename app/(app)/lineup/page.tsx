"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { InjuryDesignation, PortfolioPlayer } from "@/lib/types";
import { DataGate } from "@/components/DataGate";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/ui/states";
import { PlayerAvatar, POSITION_TEXT } from "@/components/PlayerAvatar";
import {
  INJURY_LABEL,
  injuredStarters,
  lineupEfficiency,
  type EfficiencyFlag,
  type InjuredStarter,
} from "@/lib/portfolio/lineupCheck";
import { cn, formatPoints, gameKickoffLabel, gamePhaseLabel } from "@/lib/utils";
import { track } from "@/lib/analytics";

/**
 * Lineup Check — a fast pass before kickoff:
 *   INJURED STARTERS  who's in a lineup with a designation (worst first)
 *   START / SIT       bench players out-projecting the starter in their slot
 * Every row links to that league's lineup so the swap is one tap away.
 */

const DESIGNATION_STYLE: Record<InjuryDesignation, string> = {
  ir: "border-loss/40 bg-loss/10 text-loss",
  suspended: "border-loss/40 bg-loss/10 text-loss",
  out: "border-loss/40 bg-loss/10 text-loss",
  doubtful: "border-warn/40 bg-warn/10 text-warn",
  questionable: "border-warn/40 bg-warn/5 text-warn",
};

function DesignationBadge({ injury }: { injury: InjuryDesignation }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded border px-1.5 py-0.5 text-[10px] font-bold tracking-wider",
        DESIGNATION_STYLE[injury]
      )}
    >
      {INJURY_LABEL[injury]}
    </span>
  );
}

function gameTime(p: PortfolioPlayer): string {
  if (!p.game) return p.liveStatus === "no_game" ? "No game" : "";
  return p.game.status === "scheduled" ? gameKickoffLabel(p.game) : gamePhaseLabel(p.game);
}

function groupByLeague<T extends { leagueId: string; leagueName: string }>(rows: T[]) {
  const groups = new Map<string, { name: string; rows: T[] }>();
  for (const r of rows) {
    const g = groups.get(r.leagueId) ?? { name: r.leagueName, rows: [] };
    g.rows.push(r);
    groups.set(r.leagueId, g);
  }
  return [...groups.entries()];
}

function LeagueSection({
  name,
  href,
  children,
}: {
  name: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={name}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <h2 className="truncate text-[11px] font-bold tracking-[0.14em] text-ink-faint">
          {name.toUpperCase()}
        </h2>
        <Link href={href} className="shrink-0 text-[11px] font-semibold text-accent hover:underline">
          Open lineup →
        </Link>
      </div>
      <ul className="divide-y divide-edge overflow-hidden rounded-xl border border-edge bg-surface">
        {children}
      </ul>
    </section>
  );
}

function InjuredRow({ row, href }: { row: InjuredStarter; href: string }) {
  const p = row.player;
  return (
    <li>
      <Link href={href} className="flex items-center gap-2.5 px-3 py-2 transition-colors hover:bg-surface-2/60">
        <PlayerAvatar player={p.player} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold text-ink">{p.player.fullName}</span>
          <span className="tnum block truncate text-[11px] text-ink-dim">
            <span className={cn("font-bold", POSITION_TEXT[p.player.position])}>{p.player.position}</span>
            {" · "}
            {p.player.nflTeam}
            {" · slot "}
            {row.slot}
          </span>
        </span>
        <DesignationBadge injury={row.injury} />
        <span className="tnum w-16 shrink-0 text-right text-[11px] font-semibold text-ink-dim">
          {gameTime(p)}
        </span>
      </Link>
    </li>
  );
}

function Side({
  p,
  projected,
  tag,
}: {
  p: PortfolioPlayer;
  projected: number;
  tag: "SIT" | "START";
}) {
  const start = tag === "START";
  return (
    <span className="flex min-w-0 flex-1 items-center gap-2">
      <span
        className={cn(
          "w-10 shrink-0 rounded border px-1 py-px text-center text-[8px] font-bold tracking-wider",
          start ? "border-win/40 bg-win/10 text-win" : "border-edge bg-surface-2 text-ink-faint"
        )}
      >
        {tag}
      </span>
      <PlayerAvatar player={p.player} size="sm" className="h-6 w-6 text-[9px]" />
      <span className="min-w-0">
        <span className={cn("block truncate text-xs font-bold", start ? "text-ink" : "text-ink-dim")}>
          {p.player.fullName}
        </span>
        <span className="tnum block truncate text-[10px] text-ink-faint">
          <span className={cn("font-bold", POSITION_TEXT[p.player.position])}>{p.player.position}</span>
          {" · "}
          {p.player.nflTeam} · proj {formatPoints(projected)}
        </span>
      </span>
    </span>
  );
}

function FlagRow({ flag, href }: { flag: EfficiencyFlag; href: string }) {
  return (
    <li>
      <Link href={href} className="flex items-center gap-2 px-3 py-2 transition-colors hover:bg-surface-2/60">
        <span className="w-9 shrink-0 text-center text-[9px] font-bold tracking-wider text-ink-faint">
          {flag.slot}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-2">
          <Side p={flag.starter} projected={flag.starterProjected} tag="SIT" />
          <ArrowRight size={14} aria-hidden className="hidden shrink-0 text-ink-faint sm:block" />
          <Side p={flag.bench} projected={flag.benchProjected} tag="START" />
        </span>
        <span className="tnum w-12 shrink-0 text-right text-sm font-black text-win">
          +{formatPoints(flag.delta)}
        </span>
      </Link>
    </li>
  );
}

type Tab = "injured" | "efficiency";

export default function LineupPage() {
  const [tab, setTab] = useState<Tab>("injured");

  useEffect(() => {
    track("lineup_viewed");
  }, []);

  return (
    <DataGate>
      {(portfolio, snapshot) => {
        const injured = injuredStarters(portfolio.players);
        const flags = lineupEfficiency(portfolio.players, snapshot.games.length > 0);
        const matchupByLeague = new Map(portfolio.matchups.map((m) => [m.league.id, m.matchup.id]));
        const lineupHref = (leagueId: string) =>
          matchupByLeague.has(leagueId) ? `/teams/${matchupByLeague.get(leagueId)}` : "/teams";

        const tabs: { id: Tab; label: string; count: number }[] = [
          { id: "injured", label: "Injured starters", count: injured.length },
          { id: "efficiency", label: "Start / sit", count: flags.length },
        ];

        return (
          <div className="space-y-4">
            <PageHeader
              title="Lineup Check"
              subtitle={
                <span className="tnum">
                  Week {snapshot.meta.week} · {injured.length} injured starter{injured.length === 1 ? "" : "s"} ·{" "}
                  {flags.length} start/sit flag{flags.length === 1 ? "" : "s"}
                </span>
              }
            />

            <div role="tablist" aria-label="Lineup checks" className="flex gap-2">
              {tabs.map((t) => {
                const active = tab === t.id;
                return (
                  <button
                    key={t.id}
                    role="tab"
                    type="button"
                    aria-selected={active}
                    onClick={() => setTab(t.id)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition-colors",
                      active
                        ? "border-accent bg-accent text-accent-ink"
                        : "border-edge bg-surface text-ink-dim hover:border-edge-strong hover:text-ink"
                    )}
                  >
                    {t.label}
                    <span
                      className={cn(
                        "tnum rounded-full px-1.5 text-[10px]",
                        active ? "bg-accent-ink/20" : t.count > 0 ? "bg-loss/15 text-loss" : "bg-surface-3 text-ink-faint"
                      )}
                    >
                      {t.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {tab === "injured" ? (
              injured.length === 0 ? (
                <EmptyState
                  title="No injured starters"
                  message="Every player in your starting lineups is clear of the injury report."
                />
              ) : (
                <div className="space-y-4">
                  {groupByLeague(injured).map(([leagueId, g]) => (
                    <LeagueSection key={leagueId} name={g.name} href={lineupHref(leagueId)}>
                      {g.rows.map((row) => (
                        <InjuredRow key={`${row.leagueId}-${row.slot}-${row.player.player.id}`} row={row} href={lineupHref(leagueId)} />
                      ))}
                    </LeagueSection>
                  ))}
                </div>
              )
            ) : flags.length === 0 ? (
              <EmptyState
                title="Your lineups look efficient"
                message="No healthy bench player with a game this week projects higher than the starter in a slot he could fill."
              />
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-ink-dim">
                  Slots where a healthy bench player with a game this week projects higher than your
                  starter. Locked players (game on or over) are skipped.
                </p>
                {groupByLeague(flags).map(([leagueId, g]) => (
                  <LeagueSection key={leagueId} name={g.name} href={lineupHref(leagueId)}>
                    {g.rows.map((flag) => (
                      <FlagRow key={`${flag.slot}-${flag.starter.player.id}-${flag.bench.player.id}`} flag={flag} href={lineupHref(leagueId)} />
                    ))}
                  </LeagueSection>
                ))}
              </div>
            )}
          </div>
        );
      }}
    </DataGate>
  );
}
