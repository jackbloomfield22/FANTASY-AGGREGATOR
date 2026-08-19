"use client";

import { use, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { DataGate } from "@/components/DataGate";
import { EmptyState } from "@/components/ui/states";
import { LiveIndicator } from "@/components/ui/badges";
import { MiniFootballField } from "@/components/MiniFootballField";
import { PlayerRow } from "@/components/PlayerCard";
import {
  cn,
  downDistanceLabel,
  fieldPositionLabel,
  gamePhaseLabel,
} from "@/lib/utils";
import { track } from "@/lib/analytics";

export default function GameDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  useEffect(() => {
    track("game_opened", { id });
  }, [id]);

  return (
    <DataGate>
      {(portfolio) => {
        const ranked = portfolio.games.find((g) => g.game.id === id);
        if (!ranked) {
          return (
            <EmptyState
              title="Game not found"
              message="This game isn't part of the current week."
              action={
                <Link href="/games" className="text-sm font-semibold text-accent hover:underline">
                  Back to NFL games
                </Link>
              }
            />
          );
        }
        const { game } = ranked;
        const isLive = game.status === "live" || game.status === "halftime";
        const starters = ranked.players.filter((p) => p.starterCount > 0);
        const benchOnly = ranked.players.filter((p) => p.starterCount === 0);
        const fieldPos = fieldPositionLabel(game);
        const downDist = downDistanceLabel(game);

        return (
          <div className="space-y-4">
            <Link href="/games" className="inline-flex items-center gap-1 text-xs font-semibold text-ink-dim hover:text-ink">
              <ArrowLeft size={14} aria-hidden /> NFL Games
            </Link>

            <header
              className={cn(
                "rounded-xl border border-edge bg-surface p-4",
                game.redZone && ranked.starterCount > 0 && "redzone-glow"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="tnum text-3xl font-black text-ink">
                  {game.awayTeam} {game.status === "scheduled" ? "" : game.awayScore}
                  <span className="mx-2 text-ink-faint">—</span>
                  {game.homeTeam} {game.status === "scheduled" ? "" : game.homeScore}
                </p>
                <div className="flex flex-col items-end gap-0.5">
                  {isLive ? <LiveIndicator /> : null}
                  <span className="tnum text-sm font-semibold text-ink-dim">{gamePhaseLabel(game)}</span>
                </div>
              </div>
              {game.possessionTeam ? (
                <p className="tnum mt-1 text-xs font-semibold text-ink-dim">
                  {game.possessionTeam} ball{fieldPos ? ` · ${fieldPos}` : ""}
                  {downDist ? ` · ${downDist}` : ""}
                  {game.driveSummary ? ` · drive: ${game.driveSummary}` : ""}
                  {game.redZone ? <span className="ml-1.5 font-bold text-redzone">RED ZONE</span> : null}
                </p>
              ) : null}
              {game.ballYardLine !== null ? <MiniFootballField game={game} className="mt-3" /> : null}
            </header>

            <section aria-label="Your players in this game" className="space-y-3">
              <h2 className="text-sm font-bold text-ink">
                Your players in this game{" "}
                <span className="tnum text-xs font-medium text-ink-dim">
                  ({ranked.players.length} rostered · {ranked.starterCount} starting)
                </span>
              </h2>
              {ranked.players.length === 0 ? (
                <EmptyState title="None of your players are in this game" />
              ) : (
                <>
                  {starters.length > 0 ? (
                    <div className="space-y-2">
                      <h3 className="text-[10px] font-bold tracking-[0.14em] text-ink-faint">
                        STARTING SOMEWHERE
                      </h3>
                      {starters.map((p) => (
                        <div key={p.player.id}>
                          <PlayerRow player={p} />
                          <p className="tnum mt-0.5 px-3 text-[11px] text-ink-faint">
                            {p.leagues
                              .map(
                                (l) =>
                                  `${l.isStarter ? "START" : "BENCH"} · ${l.leagueName} · ${l.points.toFixed(1)}`
                              )
                              .join("  ·  ")}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {benchOnly.length > 0 ? (
                    <div className="space-y-2">
                      <h3 className="text-[10px] font-bold tracking-[0.14em] text-ink-faint">
                        BENCH ONLY
                      </h3>
                      {benchOnly.map((p) => (
                        <PlayerRow key={p.player.id} player={p} />
                      ))}
                    </div>
                  ) : null}
                </>
              )}
            </section>
          </div>
        );
      }}
    </DataGate>
  );
}
