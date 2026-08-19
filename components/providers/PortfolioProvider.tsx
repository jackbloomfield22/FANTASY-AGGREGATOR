"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { PortfolioSnapshot } from "@/lib/types";
import { aggregatePortfolio, type AggregatedPortfolio } from "@/lib/portfolio/aggregate";
import { track } from "@/lib/analytics";

/**
 * Client-side portfolio store.
 *
 * One snapshot fetch feeds every screen (no per-player requests). Polling is
 * adaptive: fast while NFL games are live, slow otherwise, paused when the
 * tab is hidden. Manual refresh is always available.
 */

const LIVE_POLL_MS = 20_000;
const IDLE_POLL_MS = 120_000;

interface PortfolioContextValue {
  snapshot: PortfolioSnapshot | null;
  portfolio: AggregatedPortfolio | null;
  loading: boolean;
  error: string | null;
  lastUpdatedAt: number | null;
  refresh: (manual?: boolean) => Promise<void>;
}

const PortfolioContext = createContext<PortfolioContextValue | null>(null);

export function PortfolioProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<PortfolioSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const inFlight = useRef(false);
  const snapshotRef = useRef<PortfolioSnapshot | null>(null);

  const refresh = useCallback(async (manual = false) => {
    if (inFlight.current) return;
    inFlight.current = true;
    if (manual) track("manual_refresh");
    try {
      const res = await fetch("/api/portfolio", { cache: "no-store" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `Request failed (${res.status})`);
      }
      const data = (await res.json()) as PortfolioSnapshot;
      snapshotRef.current = data;
      setSnapshot(data);
      setError(null);
      setLastUpdatedAt(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load your portfolio.");
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const id = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(id);
  }, [refresh]);

  // Adaptive polling, paused while the tab is hidden.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const schedule = () => {
      if (cancelled) return;
      const snap = snapshotRef.current;
      const anyLive = snap?.games.some((g) => g.status === "live" || g.status === "halftime");
      const delay = anyLive ? LIVE_POLL_MS : IDLE_POLL_MS;
      timer = setTimeout(async () => {
        if (!document.hidden) await refresh();
        schedule();
      }, delay);
    };
    schedule();

    const onVisible = () => {
      if (!document.hidden) void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  const portfolio = useMemo(
    () => (snapshot ? aggregatePortfolio(snapshot) : null),
    [snapshot]
  );

  const value = useMemo(
    () => ({ snapshot, portfolio, loading, error, lastUpdatedAt, refresh }),
    [snapshot, portfolio, loading, error, lastUpdatedAt, refresh]
  );

  return <PortfolioContext.Provider value={value}>{children}</PortfolioContext.Provider>;
}

export function usePortfolio(): PortfolioContextValue {
  const ctx = useContext(PortfolioContext);
  if (!ctx) throw new Error("usePortfolio must be used inside <PortfolioProvider>");
  return ctx;
}

/** Seconds since the last successful refresh, re-rendering once per second. */
export function useSecondsSinceUpdate(): number | null {
  const { lastUpdatedAt } = usePortfolio();
  const [seconds, setSeconds] = useState<number | null>(null);
  useEffect(() => {
    const compute = () =>
      setSeconds(lastUpdatedAt ? Math.round((Date.now() - lastUpdatedAt) / 1000) : null);
    const initial = setTimeout(compute, 0);
    const id = setInterval(compute, 1000);
    return () => {
      clearTimeout(initial);
      clearInterval(id);
    };
  }, [lastUpdatedAt]);
  return seconds;
}
