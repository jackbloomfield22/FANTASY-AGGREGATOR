"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { usePortfolio } from "@/components/providers/PortfolioProvider";
import { track } from "@/lib/analytics";
import { cn, timeAgo } from "@/lib/utils";

/**
 * Sleeper connection card: enter a username, sync leagues, manage the
 * connection. Used in onboarding and settings.
 */
export function SleeperConnectCard({ onConnected }: { onConnected?: () => void }) {
  const { snapshot, refresh } = usePortfolio();
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState<"connect" | "sync" | "disconnect" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const connection = snapshot?.meta.connections.find((c) => c.provider === "sleeper");
  const connected = connection?.status === "connected";
  const simActive =
    connected && snapshot?.meta.liveSource === "demo" && snapshot?.meta.fantasySource === "sleeper";
  const canSimulate = connected && snapshot?.meta.liveSource !== "sportradar";

  const toggleSim = async () => {
    setBusy("sync");
    setError(null);
    try {
      const res = await fetch("/api/demo/simulate", { method: simActive ? "DELETE" : "POST" });
      if (!res.ok) {
        setError("Couldn't toggle the simulation — try again.");
        return;
      }
      setNotice(
        simActive
          ? "Simulation off — back to real data only."
          : "Simulating a live Sunday over your real rosters. Look for the SIM LIVE badge."
      );
      await refresh();
    } catch {
      setError("Network error toggling the simulation — try again.");
    } finally {
      setBusy(null);
    }
  };

  const connect = async () => {
    setBusy("connect");
    setError(null);
    track("fantasy_connection_started", { provider: "sleeper" });
    try {
      const res = await fetch("/api/connections/sleeper", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Could not connect to Sleeper.");
        return;
      }
      track("fantasy_connection_completed", { provider: "sleeper", leagues: body.leagues?.length ?? 0 });
      setNotice(`Connected ${body.user.displayName} — ${body.leagues.length} league${body.leagues.length === 1 ? "" : "s"} synced.`);
      await refresh();
      onConnected?.();
      router.refresh();
    } catch {
      setError("Network error connecting to Sleeper.");
    } finally {
      setBusy(null);
    }
  };

  const syncNow = async () => {
    setBusy("sync");
    setError(null);
    try {
      const res = await fetch("/api/sync/sleeper", { method: "POST" });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Sync failed.");
        return;
      }
      track("fantasy_sync_completed", { provider: "sleeper" });
      setNotice(`Synced ${body.leagues} leagues.`);
      await refresh();
    } catch {
      setError("Network error during sync.");
    } finally {
      setBusy(null);
    }
  };

  const disconnect = async () => {
    setBusy("disconnect");
    setError(null);
    try {
      await fetch("/api/connections/sleeper", { method: "DELETE" });
      setNotice("Sleeper disconnected.");
      await refresh();
      router.refresh();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="rounded-xl border border-edge bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-ink">Sleeper</p>
          <p className="text-xs text-ink-dim">
            {connected
              ? `Connected as ${connection?.providerUsername} · last synced ${timeAgo(connection?.lastSyncedAt ?? null)}`
              : "Read-only via Sleeper's public API — just your username, no password."}
          </p>
        </div>
        {connected ? (
          <span className="rounded border border-win/40 bg-win/10 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-win">
            CONNECTED
          </span>
        ) : null}
      </div>

      {connected ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void syncNow()}
            disabled={busy !== null}
            className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-bold text-accent-ink hover:opacity-90 disabled:opacity-50"
          >
            {busy === "sync" ? <Loader2 size={13} className="animate-spin" aria-hidden /> : null}
            Sync now
          </button>
          <button
            type="button"
            onClick={() => void disconnect()}
            disabled={busy !== null}
            className="rounded-md border border-edge bg-surface-2 px-3 py-1.5 text-xs font-semibold text-ink-dim hover:bg-surface-3 hover:text-ink disabled:opacity-50"
          >
            Disconnect
          </button>
          {canSimulate ? (
            <button
              type="button"
              onClick={() => void toggleSim()}
              disabled={busy !== null}
              title="No live NFL data provider is configured — fabricate a mid-Sunday (games live, stats moving) over your real rosters so you can see the product in motion."
              className={cn(
                "rounded-md border px-3 py-1.5 text-xs font-bold disabled:opacity-50",
                simActive
                  ? "border-warn/40 bg-warn/10 text-warn hover:bg-warn/20"
                  : "border-edge bg-surface-2 text-ink hover:bg-surface-3"
              )}
            >
              {simActive ? "Stop live simulation" : "Simulate live Sunday"}
            </button>
          ) : null}
        </div>
      ) : (
        <form
          className="mt-3 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void connect();
          }}
        >
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Sleeper username"
            aria-label="Sleeper username"
            autoComplete="off"
            className="w-full max-w-xs rounded-md border border-edge bg-surface-2 px-3 py-1.5 text-sm text-ink placeholder:text-ink-faint focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy !== null || username.trim().length === 0}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-xs font-bold text-accent-ink hover:opacity-90 disabled:opacity-50"
          >
            {busy === "connect" ? <Loader2 size={13} className="animate-spin" aria-hidden /> : null}
            Connect
          </button>
        </form>
      )}

      {error ? <p role="alert" className="mt-2 text-xs font-medium text-loss">{error}</p> : null}
      {notice && !error ? <p className="mt-2 text-xs font-medium text-win">{notice}</p> : null}
    </div>
  );
}
