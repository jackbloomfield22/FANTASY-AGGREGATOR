"use client";

import { use, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DataGate } from "@/components/DataGate";
import { EmptyState } from "@/components/ui/states";
import { WinProbability } from "@/components/FantasyMatchupCard";
import { MatchupStatusBadge, StatusBadge } from "@/components/ui/badges";
import { statLineText } from "@/components/PlayerStatLine";
import { calculateFantasyPoints, scoringLabel } from "@/lib/scoring/engine";
import { playerLiveStatus } from "@/lib/portfolio/aggregate";
import { cn, formatPoints, gamePhaseLabel, SLOT_ORDER } from "@/lib/utils";
import { track } from "@/lib/analytics";
import type {
  NormalizedLeague,
  NormalizedRosterSlot,
  PortfolioSnapshot,
} from "@/lib/types";

interface LineupRow {
  slot: NormalizedRosterSlot;
  name: string;
  playerId: string;
  position: string;
  nflTeam: string;
  gameLabel: string;
  statLine: string;
  points: number;
  status: ReturnType<typeof playerLiveStatus>;
}

function buildLineup(
  snapshot: PortfolioSnapshot,
  league: NormalizedLeague,
  teamId: string
): { starters: LineupRow[]; bench: LineupRow[] } {
  const playerById = new Map(snapshot.players.map((p) => [p.id, p]));
  const statsByPlayer = new Map(snapshot.playerStats.map((s) => [s.playerId, s.stats]));
  const gameByTeam = new Map(
    snapshot.games.flatMap((g) => [
      [g.homeTeam, g] as const,
      [g.awayTeam, g] as const,
    ])
  );

  const rows: LineupRow[] = snapshot.rosterSlots
    .filter((s) => s.fantasyTeamId === teamId)
    .map((slot): LineupRow | null => {
      const player = playerById.get(slot.playerId);
      if (!player) return null;
      const stats = statsByPlayer.get(player.id) ?? null;
      const game = gameByTeam.get(player.nflTeam) ?? null;
      const points = stats
        ? calculateFantasyPoints(stats, league.scoringSettings)
        : slot.providerPoints ?? 0;
      return {
        slot,
        name: player.fullName,
        playerId: player.id,
        position: player.position,
        nflTeam: player.nflTeam,
        gameLabel: game
          ? `${game.awayTeam} @ ${game.homeTeam} · ${gamePhaseLabel(game)}`
          : "No game",
        statLine: statLineText(player.position, stats),
        points,
        status: playerLiveStatus(game, player),
      };
    })
    .filter((r): r is LineupRow => r !== null)
    .sort(
      (a, b) =>
        (SLOT_ORDER[a.slot.slot] ?? 9) - (SLOT_ORDER[b.slot.slot] ?? 9) ||
        b.points - a.points
    );

  return {
    starters: rows.filter((r) => r.slot.isStarter),
    bench: rows.filter((r) => !r.slot.isStarter),
  };
}

function LineupTable({ title, rows }: { title: string; rows: LineupRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div>
      <h3 className="mb-1.5 text-[10px] font-bold tracking-[0.14em] text-ink-faint">{title}</h3>
      <ul className="divide-y divide-edge overflow-hidden rounded-lg border border-edge bg-surface">
        {rows.map((r) => (
          <li key={r.slot.id} className="flex items-center gap-3 px-3 py-2">
            <span className="w-9 shrink-0 text-[10px] font-bold text-ink-faint">{r.slot.slot}</span>
            <div className="min-w-0 flex-1">
              <Link href={`/players/${r.playerId}`} className="block truncate text-sm font-semibold text-ink hover:text-accent">
                {r.name}
                <span className="ml-1.5 text-xs font-medium text-ink-faint">
                  {r.position} · {r.nflTeam}
                </span>
              </Link>
              <p className="tnum truncate text-[11px] text-ink-dim">
                {r.gameLabel} · {r.statLine}
              </p>
            </div>
            <StatusBadge status={r.status} className="hidden sm:inline-flex" />
            <span className="tnum w-12 shrink-0 text-right text-sm font-bold text-ink">
              {formatPoints(r.points)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function MatchupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  useEffect(() => {
    track("matchup_opened", { id });
  }, [id]);

  return (
    <DataGate>
      {(portfolio, snapshot) => {
        const view = portfolio.matchups.find((m) => m.matchup.id === id);
        if (!view) {
          return (
            <EmptyState
              title="Matchup not found"
              message="This matchup isn't part of your current week."
              action={
                <Link href="/teams" className="text-sm font-semibold text-accent hover:underline">
                  Back to teams
                </Link>
              }
            />
          );
        }
        const { matchup, league, userTeam, opponentTeam } = view;
        const user = buildLineup(snapshot, league, matchup.userTeamId);
        const opp = buildLineup(snapshot, league, matchup.opponentTeamId);
        const isFinal = matchup.status === "final";

        return (
          <div className="space-y-4">
            <Link href="/teams" className="inline-flex items-center gap-1 text-xs font-semibold text-ink-dim hover:text-ink">
              <ArrowLeft size={14} aria-hidden /> Teams
            </Link>

            <header className="rounded-xl border border-edge bg-surface p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-faint">
                  {league.name} · Week {matchup.week} · {scoringLabel(league.scoringType)}
                </p>
                <MatchupStatusBadge
                  status={matchup.status}
                  won={isFinal ? matchup.userScore > matchup.opponentScore : undefined}
                />
              </div>
              <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                <div className="min-w-0">
                  <p className="truncate text-base font-bold text-ink">{userTeam.name}</p>
                  <p className="text-[11px] text-ink-faint">
                    You
                    {userTeam.record
                      ? ` · ${userTeam.record.wins}-${userTeam.record.losses}${userTeam.record.ties ? `-${userTeam.record.ties}` : ""}`
                      : ""}
                  </p>
                </div>
                <div />
                <div className="min-w-0 text-right">
                  <p className="truncate text-base font-bold text-ink">{opponentTeam.name}</p>
                  <p className="text-[11px] text-ink-faint">{opponentTeam.ownerName}</p>
                </div>
                <span className={cn("tnum text-4xl font-black leading-none", matchup.userScore >= matchup.opponentScore ? "text-ink" : "text-ink-dim")}>
                  {formatPoints(matchup.userScore)}
                </span>
                <span className="px-2 text-sm font-bold text-ink-faint">vs</span>
                <span className={cn("tnum text-right text-4xl font-black leading-none", matchup.opponentScore >= matchup.userScore ? "text-ink" : "text-ink-dim")}>
                  {formatPoints(matchup.opponentScore)}
                </span>
              </div>
              <p className="tnum mt-2 text-[11px] font-medium text-ink-dim">
                Projected {formatPoints(matchup.userProjected)} — {formatPoints(matchup.opponentProjected)}
                <span className="mx-1.5 text-ink-faint">·</span>
                Remaining — You: {view.userRemaining} · Opponent: {view.opponentRemaining}
              </p>
              {!isFinal && matchup.winProbability !== null ? (
                <WinProbability probability={matchup.winProbability} className="mt-2" />
              ) : null}
            </header>

            <div className="grid gap-4 lg:grid-cols-2">
              <section aria-label={`${userTeam.name} lineup`} className="space-y-3">
                <h2 className="text-sm font-bold text-ink">{userTeam.name}</h2>
                <LineupTable title="STARTERS" rows={user.starters} />
                <LineupTable title="BENCH" rows={user.bench} />
              </section>
              <section aria-label={`${opponentTeam.name} lineup`} className="space-y-3">
                <h2 className="text-sm font-bold text-ink">{opponentTeam.name}</h2>
                <LineupTable title="STARTERS" rows={opp.starters} />
                <LineupTable title="BENCH" rows={opp.bench} />
              </section>
            </div>
          </div>
        );
      }}
    </DataGate>
  );
}
