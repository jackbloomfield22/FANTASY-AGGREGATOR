import "server-only";
import { cookies } from "next/headers";

/**
 * Lightweight session state kept in cookies:
 *  - demo mode entry + the demo simulation's reset offset
 *  - Sleeper connection (Sleeper's API is public/read-only, so the username
 *    is the only credential-like value; nothing secret lives client-side)
 *
 * When Supabase is configured, auth itself is handled by Supabase cookies —
 * these remain the source of truth for provider connections in the MVP.
 */

export const DEMO_COOKIE = "fa-demo";
export const DEMO_EPOCH_COOKIE = "fa-demo-epoch";
export const SLEEPER_COOKIE = "fa-sleeper";
export const SIM_LIVE_COOKIE = "fa-sim-live";

export interface SleeperConnection {
  username: string;
  userId: string;
  displayName: string;
  connectedAt: string;
  lastSyncedAt: string | null;
}

export async function isDemoMode(): Promise<boolean> {
  const store = await cookies();
  return store.get(DEMO_COOKIE)?.value === "1";
}

export async function getDemoEpochOffsetMs(): Promise<number> {
  const store = await cookies();
  const raw = store.get(DEMO_EPOCH_COOKIE)?.value;
  const n = raw ? Number(raw) : 0;
  return Number.isFinite(n) ? n : 0;
}

/**
 * When the simulated live Sunday was enabled (ms epoch), or null when off.
 * The timestamp anchors the simulation so the day plays forward once.
 */
export async function getSimLiveEnabledAt(): Promise<number | null> {
  const store = await cookies();
  const raw = store.get(SIM_LIVE_COOKIE)?.value;
  if (!raw) return null;
  const n = Number(raw);
  // Legacy "1" cookies (pre-timestamp) anchor to a fixed recent moment so
  // they still resolve to a valid, monotonic simulation.
  if (!Number.isFinite(n) || n <= 0) return Date.UTC(2026, 8, 6, 18, 0, 0);
  return n;
}

export async function getSleeperConnection(): Promise<SleeperConnection | null> {
  const store = await cookies();
  const raw = store.get(SLEEPER_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<SleeperConnection>;
    if (typeof parsed.username !== "string" || typeof parsed.userId !== "string") return null;
    return {
      username: parsed.username,
      userId: parsed.userId,
      displayName: typeof parsed.displayName === "string" ? parsed.displayName : parsed.username,
      connectedAt: typeof parsed.connectedAt === "string" ? parsed.connectedAt : new Date().toISOString(),
      lastSyncedAt: typeof parsed.lastSyncedAt === "string" ? parsed.lastSyncedAt : null,
    };
  } catch {
    return null;
  }
}
