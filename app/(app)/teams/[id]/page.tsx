"use client";

import { use, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DataGate } from "@/components/DataGate";
import { EmptyState } from "@/components/ui/states";
import { WinProbability } from "@/components/FantasyMatchupCard";
import { MatchupStatusBadge } from "@/components/ui/badges";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import { statLineText } from "@/components/PlayerStatLine";
import { calculateFantasyPoints, scoringLabel } from "@/lib/scoring/engine";
import { playerLiveStatus } from "@/lib/portfolio/aggregate";
import { cn, formatPoints, gamePhaseLabel, SLOT_ORDER } from "@/lib/utils";
import { track } from "@/lib/analytics";
import type {
  NormalizedLeague,
  NormalizedPlayer,
  NormalizedRosterSlot,
  PlayerLiveStatus,
  PortfolioSnapshot,
} from "@/lib/types";

/**
 * Sleeper-style head-to-head matchup: starters aligned slot by slot —
 * my QB vs their QB on the same row — with the winning side of each duel
 * emphasized. Bench lists follow underneath.
 */

interface LineupEntry {
  slot: NormalizedRosterSlot;
  player: NormalizedPlayer;
  gameLabel: string;
  statLine: string;
  points: number;
  status: PlayerLiveStatus;
}

function buildLineup(
  snapshot: PortfolioSnapshot,
  league: NormalizedLeague,
  teamId: string
): { starters: LineupEntry[]; bench: LineupEntry[] } {
  const playerById = new Map(snapshot.players.map((p) => [p.id, p]));
  const statsByPlayer = new Map(snapshot.playerStats.map((s) => [s.playerId, s.stats]));
  const gameByTeam = new Map(
    snapshot.games.flatMap((g) => [
      [g.homeTeam, g] as const,
      [g.awayTeam, g] as const,
    ])
  );

  const rows: LineupEntry[] = snapshot.rosterSlots
    .filter((s) => s.fantasyTeamId === teamId)
    .map((slot): LineupEntry | null => {
      const player = playerById.get(slot.playerId);
      if (!player) return null;
      const stats = statsByPlayer.get(player.id) ?? null;
      const game = gameByTeam.get(player.nflTeam) ?? null;
      const points = stats
        ? calculateFantasyPoints(stats, league.scoringSettings)
        : slot.providerPoints ?? 0;
      return {
        slot,
        player,
        gameLabel: game ? gamePhaseLabel(game) : "No game",
        statLine: statLineText(player.position, stats),
        points,
        status: playerLiveStatus(game, player),
      };
    })
    .filter((r): r is LineupEntry => r !== null)
    .sort((a, b) => (SLOT_ORDER[a.slot.slot] ?? 9) - (SLOT_ORDER[b.slot.slot] ?? 9));

  return {
    starters: rows.filter((r) => r.slot.isStarter),
    bench: rows.filter((r) => !r.slot.isStarter).sort((a, b) => b.points - a.points),
  };
}

/**
 * Pair starters into positional duels: QBs face QBs, RBs face RBs, and so
 * on — leftovers in a slot face an empty side rather than sliding into the
 * wrong position.
 */
function pairDuels(
  mine: LineupEntry[],
  theirs: LineupEntry[]
): { mine?: LineupEntry; theirs?: LineupEntry }[] {
  const slots = Array.from(
    new Set([...mine, ...theirs].map((e) => e.slot.slot))
  ).sort((a, b) => (SLOT_ORDER[a] ?? 9) - (SLOT_ORDER[b] ?? 9));
  const pairs: { mine?: LineupEntry; theirs?: LineupEntry }[] = [];
  for (const slot of slots) {
    const m = mine.filter((e) => e.slot.slot === slot);
    const t = theirs.filter((e) => e.slot.slot === slot);
    for (let i = 0; i < Math.max(m.length, t.length); i++) {
      pairs.push({ mine: m[i], theirs: t[i] });
    }
  }
  return pairs;
}

const STATUS_DOT: Record<PlayerLiveStatus, string> = {
  live: "bg-live",
  red_zone: "bg-redzone",
  halftime: "bg-warn",
  upcoming: "bg-ink-faint/40",
  final: "bg-edge-strong",
  no_game: "bg-edge-strong",
};

/** One side of a head-to-head duel row. */
function DuelSide({
  entry,
  mirrored,
  winning,
}: {
  entry: LineupEntry | undefined;
  mirrored?: boolean;
  winning: boolean;
}) {
  if (!entry) {
    return <span className={cn("text-xs text-ink-faint", mirrored && "text-right")}>—</span>;
  }
  return (
    <span className={cn("flex min-w-0 items-center gap-2", mirrored && "flex-row-reverse")}>
      <span className="relative shrink-0">
        <PlayerAvatar player={entry.player} size="sm" />
        <span
          aria-hidden
          className={cn(
            "absolute -bottom-0.5 h-2 w-2 rounded-full ring-2 ring-surface",
            mirrored ? "-left-0.5" : "-right-0.5",
            STATUS_DOT[entry.status]
          )}
        />
      </span>
      <span className={cn("min-w-0", mirrored && "text-right")}>
        <Link
          href={`/players/${entry.player.id}`}
          className={cn(
            "block truncate text-xs font-semibold hover:text-accent",
            winning ? "text-ink" : "text-ink-dim"
          )}
          title={`${entry.player.fullName} — ${entry.statLine}`}
        >
          {entry.player.fullName}
        </Link>
        <span className="tnum block truncate text-[10px] text-ink-faint">
          {entry.player.nflTeam} · {entry.gameLabel}
          {entry.status === "red_zone" ? (
            <span className="font-bold text-redzone"> · RZ</span>
          ) : entry.status === "halftime" ? (
            <span> · Half</span>
          ) : null}
          <span className="sr-only">
            {entry.status === "red_zone" ? " (red zone)" : entry.status === "live" ? " (live)" : ""}
          </span>
        </span>
      </span>
    </span>
  );
}

function DuelRow({ mine, theirs }: { mine?: LineupEntry; theirs?: LineupEntry }) {
  const myPts = mine?.points ?? 0;
  const theirPts = theirs?.points ?? 0;
  const slotLabel = mine?.slot.slot ?? theirs?.slot.slot ?? "";
  return (
    <li className="grid grid-cols-[1fr_auto_38px_auto_1fr] items-center gap-x-2 px-3 py-2 sm:gap-x-3">
      <DuelSide entry={mine} winning={myPts >= theirPts} />
      <span className={cn("tnum text-sm font-black", myPts >= theirPts ? "text-ink" : "text-ink-faint")}>
        {formatPoints(myPts)}
      </span>
      <span className="text-center text-[9px] font-bold tracking-wider text-ink-faint">
        {slotLabel}
      </span>
      <span className={cn("tnum text-right text-sm font-black", theirPts >= myPts ? "text-ink" : "text-ink-faint")}>
        {formatPoints(theirPts)}
      </span>
      <DuelSide entry={theirs} mirrored winning={theirPts >= myPts} />
    </li>
  );
}

function BenchList({ title, rows, mirrored }: { title: string; rows: LineupEntry[]; mirrored?: boolean }) {
  return (
    <div>
      <h3 className={cn("mb-1.5 text-[10px] font-bold tracking-[0.14em] text-ink-faint", mirrored && "sm:text-right")}>
        {title}
      </h3>
      <ul className="divide-y divide-edge overflow-hidden rounded-lg border border-edge bg-surface">
        {rows.length === 0 ? (
          <li className="px-3 py-2 text-xs text-ink-faint">No bench players</li>
        ) : (
          rows.map((r) => (
            <li key={r.slot.id} className="flex items-center gap-2.5 px-3 py-1.5">
              <PlayerAvatar player={r.player} size="sm" className="h-6 w-6 text-[9px]" />
              <span className="min-w-0 flex-1">
                <Link
                  href={`/players/${r.player.id}`}
                  className="block truncate text-xs font-semibold text-ink-dim hover:text-accent"
                >
                  {r.player.fullName}
                </Link>
                <span className="tnum block truncate text-[10px] text-ink-faint">
                  {r.player.nflTeam} · {r.gameLabel}
                </span>
              </span>
              <span className="tnum shrink-0 text-xs font-bold text-ink-dim">{formatPoints(r.points)}</span>
            </li>
          ))
        )}
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
        const duels = pairDuels(user.starters, opp.starters);

        return (
          <div className="mx-auto max-w-3xl space-y-4">
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
                Yet to finish — You: {view.userRemaining} · Opp: {view.opponentRemaining}
              </p>
              {!isFinal && matchup.winProbability !== null ? (
                <WinProbability probability={matchup.winProbability} className="mt-2" />
              ) : null}
            </header>

            <section aria-label="Starters head-to-head">
              <h2 className="mb-1.5 text-[10px] font-bold tracking-[0.14em] text-ink-faint">
                STARTERS · HEAD TO HEAD
              </h2>
              <ul className="divide-y divide-edge overflow-hidden rounded-xl border border-edge bg-surface">
                {duels.map((d, i) => (
                  <DuelRow key={i} mine={d.mine} theirs={d.theirs} />
                ))}
              </ul>
            </section>

            <section aria-label="Bench" className="grid gap-4 sm:grid-cols-2">
              <BenchList title={`${userTeam.name} · BENCH`} rows={user.bench} />
              <BenchList title={`${opponentTeam.name} · BENCH`} rows={opp.bench} mirrored />
            </section>
          </div>
        );
      }}
    </DataGate>
  );
}
