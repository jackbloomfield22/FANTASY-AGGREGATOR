"use client";

import Link from "next/link";
import type { RankedGame } from "@/lib/types";
import { cn, gamePhaseLabel } from "@/lib/utils";
import { LiveIndicator } from "@/components/ui/badges";
import { MiniFootballField } from "@/components/MiniFootballField";

const EXPOSURE_LABEL: Record<RankedGame["exposureLevel"], string> = {
  high: "HIGH EXPOSURE",
  medium: "MEDIUM EXPOSURE",
  low: "LOW EXPOSURE",
  none: "NO PLAYERS",
};

const EXPOSURE_CLS: Record<RankedGame["exposureLevel"], string> = {
  high: "text-accent border-accent/40 bg-accent/10",
  medium: "text-ink border-edge-strong bg-surface-2",
  low: "text-ink-dim border-edge bg-surface-2",
  none: "text-ink-faint border-edge bg-surface-2",
};

function ScoreBlock({ game }: { game: RankedGame["game"] }) {
  const isLive = game.status === "live" || game.status === "halftime";
  const possDot = (team: string) =>
    isLive && game.possessionTeam === team ? (
      <span
        aria-label="has possession"
        className={cn("ml-1 inline-block h-1.5 w-1.5 rounded-full align-middle", game.redZone ? "bg-redzone" : "bg-ink-dim")}
      />
    ) : null;
  return (
    <div className="flex items-center gap-3">
      <div className="grid grid-cols-[auto_auto] items-baseline gap-x-3 gap-y-0.5">
        <span className="text-sm font-bold text-ink">
          {game.awayTeam}
          {possDot(game.awayTeam)}
        </span>
        <span className={cn("tnum text-2xl font-black leading-none", game.awayScore >= game.homeScore ? "text-ink" : "text-ink-dim")}>
          {game.status === "scheduled" ? "—" : game.awayScore}
        </span>
        <span className="text-sm font-bold text-ink">
          {game.homeTeam}
          {possDot(game.homeTeam)}
        </span>
        <span className={cn("tnum text-2xl font-black leading-none", game.homeScore >= game.awayScore ? "text-ink" : "text-ink-dim")}>
          {game.status === "scheduled" ? "—" : game.homeScore}
        </span>
      </div>
      <div className="flex flex-col gap-0.5">
        {isLive ? <LiveIndicator /> : null}
        <span className="tnum text-xs font-medium text-ink-dim">{gamePhaseLabel(game)}</span>
        {game.redZone ? (
          <span className="text-[10px] font-bold tracking-wider text-redzone">RED ZONE</span>
        ) : null}
      </div>
    </div>
  );
}

/** Game card ranked by the user's fantasy exposure. */
export function NFLGameCard({ ranked, className }: { ranked: RankedGame; className?: string }) {
  const { game } = ranked;
  const showField =
    (game.status === "live" || game.status === "halftime") && game.ballYardLine !== null;

  return (
    <article
      className={cn(
        "relative flex flex-col gap-2.5 rounded-xl border border-edge bg-surface p-3.5 transition-colors hover:border-edge-strong",
        game.redZone && ranked.starterCount > 0 && "redzone-glow",
        className
      )}
    >
      <header className="flex items-start justify-between gap-2">
        <Link href={`/games/${game.id}`} className="hover:text-accent">
          <span className="absolute inset-0" aria-hidden />
          <ScoreBlock game={game} />
        </Link>
        <span
          className={cn(
            "rounded border px-1.5 py-0.5 text-[10px] font-bold tracking-wider",
            EXPOSURE_CLS[ranked.exposureLevel]
          )}
        >
          {EXPOSURE_LABEL[ranked.exposureLevel]}
        </span>
      </header>

      {showField ? <MiniFootballField game={game} compact /> : null}

      <p className="tnum text-xs font-medium text-ink-dim">
        {ranked.players.length} rostered · {ranked.starterCount} starting
        {ranked.benchCount > 0 ? ` · ${ranked.benchCount} bench-only` : ""}
      </p>

      {ranked.players.length > 0 ? (
        <ul className="relative z-10 flex flex-wrap gap-x-3 gap-y-1">
          {ranked.players.slice(0, 6).map((p) => (
            <li key={p.player.id} className="text-[11px] font-medium text-ink-dim">
              <span className="text-ink">{p.player.fullName}</span>{" "}
              {p.starterCount > 0 ? (
                <span className="font-bold text-win">START ×{p.starterCount}</span>
              ) : (
                <span className="text-ink-faint">BENCH ×{p.rosteredCount}</span>
              )}
            </li>
          ))}
          {ranked.players.length > 6 ? (
            <li className="text-[11px] font-medium text-ink-faint">
              +{ranked.players.length - 6} more
            </li>
          ) : null}
        </ul>
      ) : null}
    </article>
  );
}

/** Hero variant for the dashboard's "Most Important Game". */
export function ImportantGameCard({ ranked, className }: { ranked: RankedGame; className?: string }) {
  const { game } = ranked;
  return (
    <section
      aria-label="Your most important game"
      className={cn(
        "relative flex flex-col gap-3 rounded-xl border border-edge bg-surface p-4",
        game.redZone && "redzone-glow",
        className
      )}
    >
      <header className="flex items-center justify-between">
        <h2 className="text-[11px] font-bold tracking-[0.14em] text-ink-faint">
          YOUR MOST IMPORTANT GAME
        </h2>
        <Link
          href={`/games/${game.id}`}
          className="text-[11px] font-semibold text-accent hover:underline"
        >
          Game detail →
        </Link>
      </header>
      <ScoreBlock game={game} />
      {game.ballYardLine !== null ? <MiniFootballField game={game} /> : null}
      <p className="tnum text-xs font-medium text-ink-dim">
        {ranked.players.length} of your players are in this game · {ranked.starterCount} starting ·{" "}
        {ranked.benchCount} benched
      </p>
      <ul className="flex flex-wrap gap-x-3 gap-y-1">
        {ranked.players.slice(0, 7).map((p) => (
          <li key={p.player.id} className="text-[11px] font-medium">
            <Link href={`/players/${p.player.id}`} className="text-ink hover:text-accent">
              {p.player.fullName}
            </Link>{" "}
            {p.starterCount > 0 ? (
              <span className="font-bold text-win">START ×{p.starterCount}</span>
            ) : (
              <span className="text-ink-faint">BENCH</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
