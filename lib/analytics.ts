"use client";

/**
 * Lightweight analytics abstraction. No vendor is configured — events are
 * buffered in memory and logged in development. Swap `deliver` for a real
 * vendor call (PostHog, Amplitude, …) without touching call sites.
 */

export type AnalyticsEvent =
  | "demo_started"
  | "signup_completed"
  | "fantasy_connection_started"
  | "fantasy_connection_completed"
  | "fantasy_sync_completed"
  | "players_viewed"
  | "player_opened"
  | "teams_viewed"
  | "matchup_opened"
  | "games_viewed"
  | "game_opened"
  | "filter_used"
  | "manual_refresh"
  | "search_used"
  | "settings_viewed";

interface QueuedEvent {
  event: AnalyticsEvent;
  props?: Record<string, string | number | boolean>;
  at: string;
}

const buffer: QueuedEvent[] = [];

export function track(
  event: AnalyticsEvent,
  props?: Record<string, string | number | boolean>
): void {
  const entry: QueuedEvent = { event, props, at: new Date().toISOString() };
  buffer.push(entry);
  if (buffer.length > 200) buffer.shift();
  deliver(entry);
}

function deliver(entry: QueuedEvent): void {
  if (process.env.NODE_ENV === "development") {
    console.debug("[analytics]", entry.event, entry.props ?? {});
  }
  // Vendor integration point — intentionally a no-op in production for now.
}

export function getBufferedEvents(): readonly QueuedEvent[] {
  return buffer;
}
