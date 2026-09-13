import type { NormalizedNFLGame, RankedGame } from "@/lib/types";

/**
 * Game windows — the way a fantasy player actually experiences the week:
 * Thursday night, Sunday early (1pm ET), Sunday late (4pm ET), Sunday night,
 * Monday night. Everything is reasoned about in Eastern Time because that's
 * how the NFL schedule is defined, regardless of where the user sits.
 *
 * When the schedule source only knows a game's DATE (no kickoff time), the
 * Sunday slates can't be told apart — those games land in a single honest
 * "Sunday" window instead of being guessed into 1pm/4pm.
 */

export type WindowId =
  | "thu"
  | "sat"
  | "sun_early"
  | "sun_late"
  | "sun_night"
  | "sun"
  | "mon"
  | "other";

export type WindowState = "live" | "upcoming" | "final";

export interface GameWindow {
  id: WindowId;
  label: string;
  short: string;
  games: RankedGame[];
  state: WindowState;
  /** Earliest kickoff among the window's games (ISO). */
  kickoffAt: string;
}

export const WINDOW_LABELS: Record<WindowId, { label: string; short: string }> = {
  thu: { label: "Thursday Night", short: "TNF" },
  sat: { label: "Saturday", short: "SAT" },
  sun_early: { label: "Sunday Early", short: "SUN 1PM" },
  sun_late: { label: "Sunday Late", short: "SUN 4PM" },
  sun_night: { label: "Sunday Night", short: "SNF" },
  sun: { label: "Sunday", short: "SUN" },
  mon: { label: "Monday Night", short: "MNF" },
  other: { label: "Other games", short: "OTHER" },
};

const ET_FORMAT = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  weekday: "short",
  hour: "numeric",
  minute: "numeric",
  hour12: false,
});
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Weekday (0 = Sunday) and hour/minute of an instant, in Eastern Time. */
export function etParts(iso: string): { weekday: number; hour: number; minute: number } | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const parts = ET_FORMAT.formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const weekday = WEEKDAYS.indexOf(get("weekday"));
  let hour = Number(get("hour"));
  if (hour === 24) hour = 0;
  return { weekday: weekday < 0 ? 0 : weekday, hour, minute: Number(get("minute")) || 0 };
}

export function windowForGame(game: NormalizedNFLGame): WindowId {
  if (game.kickoffTimeKnown === false) {
    // Date-only: the weekday is real, the slate within the day is not.
    const src = game.kickoffDate ? `${game.kickoffDate}T12:00:00Z` : game.kickoffAt;
    const d = new Date(src);
    if (Number.isNaN(d.getTime())) return "other";
    switch (d.getUTCDay()) {
      case 4:
        return "thu";
      case 6:
        return "sat";
      case 0:
        return "sun";
      case 1:
        return "mon";
      default:
        return "other";
    }
  }
  const p = etParts(game.kickoffAt);
  if (!p) return "other";
  switch (p.weekday) {
    case 4:
      return "thu";
    case 6:
      return "sat";
    case 1:
      return "mon";
    case 0:
      return p.hour < 15 ? "sun_early" : p.hour < 19 ? "sun_late" : "sun_night";
    default:
      return "other";
  }
}

function windowState(games: RankedGame[]): WindowState {
  if (games.some((g) => g.game.status === "live" || g.game.status === "halftime")) return "live";
  if (games.length > 0 && games.every((g) => g.game.status === "final")) return "final";
  return "upcoming";
}

/** Group the week's games into chronological windows. */
export function buildWindows(games: RankedGame[]): GameWindow[] {
  const byId = new Map<WindowId, RankedGame[]>();
  for (const rg of games) {
    const id = windowForGame(rg.game);
    const list = byId.get(id) ?? [];
    list.push(rg);
    byId.set(id, list);
  }
  return [...byId.entries()]
    .map(([id, list]) => {
      const sorted = [...list].sort(
        (a, b) =>
          a.game.kickoffAt.localeCompare(b.game.kickoffAt) || b.importanceScore - a.importanceScore
      );
      return {
        id,
        ...WINDOW_LABELS[id],
        games: sorted,
        state: windowState(sorted),
        kickoffAt: sorted[0]?.game.kickoffAt ?? "",
      };
    })
    .sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt));
}

/** The window to land on: live now, else the next one up, else the last. */
export function defaultWindowId(windows: GameWindow[]): WindowId | null {
  if (windows.length === 0) return null;
  const live = windows.find((w) => w.state === "live");
  if (live) return live.id;
  const upcoming = windows.find((w) => w.state === "upcoming");
  if (upcoming) return upcoming.id;
  return windows[windows.length - 1].id;
}
