"use client";

import Link from "next/link";
import type { PortfolioPlayer } from "@/lib/types";
import { cn, formatPoints, gameKickoffLabel, gamePhaseLabel } from "@/lib/utils";
import { PlayerAvatar, POSITION_TEXT } from "@/components/PlayerAvatar";
import { statLineText } from "@/components/PlayerStatLine";
import { LeagueScoreChips } from "@/components/LeagueChip";
import { LiveIndicator } from "@/components/ui/badges";

/**
 * The home page's player panel: a scoring leaderboard of YOUR players
 * (live ones first while games are on), plus a "yet to play" strip — so
 * the whole roster picture lives on one screen with the matchups.
 */

const isLiveNow = (p: PortfolioPlayer) =>
  p.liveStatus === "live" || p.liveStatus === "red_zone" || p.liveStatus === "halftime";

function LeaderRow({ p, rank }: { p: PortfolioPlayer; rank: number }) {
  const live = isLiveNow(p);
  const isRedZone = p.liveStatus === "red_zone";
  return (
    <li>
      <Link
        href={`/players/${p.player.id}`}
        className={cn(
          "flex items-center gap-2.5 px-3 py-2 transition-colors hover:bg-surface-2/60",
          isRedZone && "bg-redzone/5"
        )}
      >
        <span className="tnum w-4 shrink-0 text-right text-[11px] font-bold text-ink-faint">
          {rank}
        </span>
        <PlayerAvatar player={p.player} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-sm font-semibold text-ink">{p.player.fullName}</span>
            {isRedZone ? (
              <span className="shrink-0 rounded border border-redzone/50 bg-redzone/15 px-1 py-px text-[8px] font-bold tracking-wider text-redzone">
                RZ
              </span>
            ) : live ? (
              <span className="shrink-0 rounded border border-live/40 bg-live/10 px-1 py-px text-[8px] font-bold tracking-wider text-live">
                LIVE
              </span>
            ) : null}
          </span>
          <span className="tnum block truncate text-[11px] text-ink-dim">
            <span className={cn("font-bold", POSITION_TEXT[p.player.position])}>
              {p.player.position}
            </span>
            {" · "}
            {p.player.nflTeam}
            {p.game && p.game.status !== "scheduled" ? ` · ${gamePhaseLabel(p.game)}` : ""}
            {p.stats ? ` · ${statLineText(p.player.position, p.stats)}` : ""}
          </span>
          {/* What he adds in EACH league — never a single rolled-up number. */}
          <LeagueScoreChips contexts={p.leagues} className="mt-1" />
        </span>
      </Link>
    </li>
  );
}

export function HomePlayersPanel({
  players,
  className,
}: {
  players: PortfolioPlayer[];
  className?: string;
}) {
  const anyLive = players.some(isLiveNow);
  const byPoints = (a: PortfolioPlayer, b: PortfolioPlayer) =>
    b.portfolioImpact - a.portfolioImpact || b.benchPoints - a.benchPoints;

  // While games are on, the board is your live scorers; otherwise it's the
  // week's top scorers so far (real Sleeper points even with no live feed).
  const board = (anyLive
    ? players.filter(isLiveNow)
    : players.filter((p) => !isLiveNow(p) && (p.portfolioImpact > 0 || p.benchPoints > 0))
  )
    .slice()
    .sort(byPoints)
    .slice(0, 8);

  const yetToPlay = players
    .filter((p) => p.liveStatus === "upcoming")
    .sort(
      (a, b) =>
        (a.game?.kickoffAt ?? "9999").localeCompare(b.game?.kickoffAt ?? "9999") ||
        b.projectedImpact - a.projectedImpact
    );

  if (players.length === 0) return null;

  return (
    <section aria-label="Your players" className={className}>
      <div className="mb-1.5 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-[11px] font-bold tracking-[0.14em] text-ink-faint">
          {anyLive ? (
            <>
              <LiveIndicator label="" /> <span className="text-live">PLAYERS ON THE FIELD</span>
            </>
          ) : (
            "TOP SCORERS THIS WEEK"
          )}
        </h2>
        <Link href="/players" className="text-[11px] font-semibold text-accent hover:underline">
          All players →
        </Link>
      </div>

      {board.length > 0 ? (
        <ol className="divide-y divide-edge overflow-hidden rounded-xl border border-edge bg-surface">
          {board.map((p, i) => (
            <LeaderRow key={p.player.id} p={p} rank={i + 1} />
          ))}
        </ol>
      ) : (
        <p className="rounded-xl border border-dashed border-edge bg-surface px-4 py-6 text-center text-sm text-ink-dim">
          No points on the board yet this week.
        </p>
      )}

      {yetToPlay.length > 0 ? (
        <div className="mt-3">
          <h3 className="mb-1.5 text-[10px] font-bold tracking-[0.14em] text-ink-faint">
            YET TO PLAY · {yetToPlay.length}
          </h3>
          <ul className="scroll-thin flex gap-2 overflow-x-auto pb-1">
            {yetToPlay.map((p) => (
              <li key={p.player.id} className="shrink-0">
                <Link
                  href={`/players/${p.player.id}`}
                  className="flex items-center gap-2 rounded-full border border-edge bg-surface py-1 pl-1 pr-3 transition-colors hover:border-edge-strong"
                >
                  <PlayerAvatar player={p.player} size="sm" className="h-6 w-6 text-[9px]" />
                  <span className="text-xs font-semibold text-ink">{p.player.fullName}</span>
                  <span className="tnum text-[10px] text-ink-faint">
                    {[
                      p.game ? gameKickoffLabel(p.game) : null,
                      p.projectedPerLineup ? `proj ${formatPoints(p.projectedPerLineup)}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
