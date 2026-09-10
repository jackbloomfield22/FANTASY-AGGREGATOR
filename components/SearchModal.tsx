"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { usePortfolio } from "@/components/providers/PortfolioProvider";
import { PlayerAvatar } from "@/components/PlayerAvatar";
import type { NormalizedPlayer } from "@/lib/types";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";

interface SearchResult {
  key: string;
  group: "Players" | "Fantasy teams" | "Leagues" | "NFL teams";
  label: string;
  sub: string;
  href: string;
  player?: NormalizedPlayer;
}

/** Global search across players, fantasy teams, leagues and NFL teams. */
export function SearchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { portfolio, snapshot } = usePortfolio();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Escape closes (⌘K toggling lives in AppShell).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => {
      setQuery("");
      inputRef.current?.focus();
    }, 0);
    return () => clearTimeout(id);
  }, [open]);

  const results = useMemo<SearchResult[]>(() => {
    if (!portfolio || !snapshot || query.trim().length < 1) return [];
    const q = query.trim().toLowerCase();
    const out: SearchResult[] = [];

    for (const p of portfolio.players) {
      if (p.player.fullName.toLowerCase().includes(q)) {
        out.push({
          key: `pl-${p.player.id}`,
          group: "Players",
          player: p.player,
          label: p.player.fullName,
          sub: `${p.player.position} · ${p.player.nflTeam} · ${p.rosteredCount} league${p.rosteredCount === 1 ? "" : "s"}`,
          href: `/players/${p.player.id}`,
        });
      }
    }
    for (const m of portfolio.matchups) {
      for (const team of [m.userTeam, m.opponentTeam]) {
        if (team.name.toLowerCase().includes(q)) {
          out.push({
            key: `ft-${team.id}`,
            group: "Fantasy teams",
            label: team.name,
            sub: m.league.name,
            href: `/teams/${m.matchup.id}`,
          });
        }
      }
      if (m.league.name.toLowerCase().includes(q)) {
        out.push({
          key: `lg-${m.league.id}`,
          group: "Leagues",
          label: m.league.name,
          sub: `Week ${m.league.week} matchup`,
          href: `/teams/${m.matchup.id}`,
        });
      }
    }
    for (const g of portfolio.games) {
      const teams = [g.game.homeTeam, g.game.awayTeam];
      if (teams.some((t) => t.toLowerCase().includes(q))) {
        out.push({
          key: `nfl-${g.game.id}`,
          group: "NFL teams",
          label: `${g.game.awayTeam} @ ${g.game.homeTeam}`,
          sub: `${g.players.length} of your players`,
          href: `/games/${g.game.id}`,
        });
      }
    }
    return out.slice(0, 12);
  }, [portfolio, snapshot, query]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Search"
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-[12vh]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl border border-edge bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-edge px-3">
          <Search size={16} className="text-ink-faint" aria-hidden />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search players, teams, leagues, NFL teams…"
            className="w-full bg-transparent py-3 text-sm text-ink placeholder:text-ink-faint focus:outline-none"
            aria-label="Search"
          />
          <button type="button" onClick={onClose} aria-label="Close search" className="text-ink-faint hover:text-ink">
            <X size={16} aria-hidden />
          </button>
        </div>
        <ul className="max-h-80 overflow-y-auto p-2">
          {query.trim().length > 0 && results.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-ink-faint">No matches.</li>
          ) : null}
          {results.map((r, i) => (
            <li key={r.key}>
              <button
                type="button"
                onClick={() => {
                  track("search_used", { query, group: r.group });
                  router.push(r.href);
                  onClose();
                }}
                className={cn(
                  "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left hover:bg-surface-2",
                  i === 0 && "bg-surface-2/60"
                )}
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  {r.player ? <PlayerAvatar player={r.player} size="sm" /> : null}
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-ink">{r.label}</span>
                    <span className="block truncate text-[11px] text-ink-dim">{r.sub}</span>
                  </span>
                </span>
                <span className="shrink-0 rounded border border-edge bg-surface-2 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-ink-faint">
                  {r.group}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
