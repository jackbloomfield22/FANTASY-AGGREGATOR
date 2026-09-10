import type { NormalizedNFLGame, PlayerLiveStatus } from "@/lib/types";

/** Minimal className combiner. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function formatPoints(n: number): string {
  return (Math.round(n * 10) / 10).toFixed(1);
}

export function formatSigned(n: number): string {
  const v = formatPoints(Math.abs(n));
  return n >= 0 ? `+${v}` : `-${v}`;
}

export function formatPercent(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

const QUARTER_LABEL: Record<number, string> = { 1: "1st", 2: "2nd", 3: "3rd", 4: "4th", 5: "OT" };

/** "3rd · 8:41", "Halftime", "Final", or kickoff time. */
export function gamePhaseLabel(game: NormalizedNFLGame): string {
  switch (game.status) {
    case "final":
      return "Final";
    case "halftime":
      return "Halftime";
    case "live":
      // Some live sources (Sleeper schedule) carry status but no clock.
      if (game.quarter === null && game.clock === null) return "Live";
      return `${QUARTER_LABEL[game.quarter ?? 1] ?? `Q${game.quarter}`} · ${game.clock ?? ""}`.trim();
    case "scheduled":
      return kickoffLabel(game.kickoffAt);
  }
}

export function kickoffLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Upcoming";
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function timeAgo(iso: string | null, nowMs = Date.now()): string {
  if (!iso) return "never";
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "unknown";
  const sec = Math.max(0, Math.round((nowMs - then) / 1000));
  if (sec < 10) return "just now";
  if (sec < 60) return `${sec} sec ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

/** Field-position label from the possessing team's perspective, e.g. "SEA 8". */
export function fieldPositionLabel(game: NormalizedNFLGame): string | null {
  if (game.ballYardLine === null || !game.possessionTeam) return null;
  const opponent = game.possessionTeam === game.homeTeam ? game.awayTeam : game.homeTeam;
  if (game.ballYardLine === 50) return "midfield";
  return game.ballYardLine > 50
    ? `${opponent} ${100 - game.ballYardLine}`
    : `${game.possessionTeam} ${game.ballYardLine}`;
}

export function downDistanceLabel(game: NormalizedNFLGame): string | null {
  if (game.down === null || game.distance === null) return null;
  const suffix = ["", "st", "nd", "rd", "th"][game.down] ?? "th";
  return `${game.down}${suffix} & ${game.distance}`;
}

export const LIVE_STATUS_LABEL: Record<PlayerLiveStatus, string> = {
  live: "Live",
  red_zone: "Red Zone",
  halftime: "Halftime",
  upcoming: "Upcoming",
  final: "Final",
  played: "Played",
  no_game: "No game",
};

/** Position sort order for lineups. */
export const POSITION_ORDER: Record<string, number> = {
  QB: 0,
  RB: 1,
  WR: 2,
  TE: 3,
  FLEX: 4,
  K: 5,
  DST: 6,
  BN: 7,
};

export const SLOT_ORDER: Record<string, number> = POSITION_ORDER;
