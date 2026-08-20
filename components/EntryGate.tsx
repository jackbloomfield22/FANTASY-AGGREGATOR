"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { track } from "@/lib/analytics";

/**
 * The front door: enter a Sleeper username to step straight into your real
 * portfolio, or take the demo. Shown to everyone without a session.
 */
export function EntryGate() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState<"connect" | "simulate" | null>(null);
  const [error, setError] = useState<string | null>(null);

  /** Connect the Sleeper account; optionally drop it into a simulated live Sunday. */
  const enter = async (simulate: boolean) => {
    if (username.trim().length === 0) {
      setError("Enter your Sleeper username first.");
      return;
    }
    setBusy(simulate ? "simulate" : "connect");
    setError(null);
    track("fantasy_connection_started", { provider: "sleeper", from: "entry", simulate });
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
      if (simulate) {
        track("demo_started", { from: "entry" });
        await fetch("/api/demo/simulate", { method: "POST" });
      }
      track("fantasy_connection_completed", { provider: "sleeper", from: "entry", simulate });
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Network error reaching Sleeper — try again.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="w-full max-w-sm rounded-2xl border border-edge bg-surface p-6 shadow-2xl">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void enter(false);
        }}
      >
        <label htmlFor="sleeper-username" className="block text-left text-xs font-bold uppercase tracking-wider text-ink-dim">
          Sleeper username
        </label>
        <p className="mt-0.5 text-left text-[11px] text-ink-faint">
          Read-only via Sleeper&apos;s public API — no password needed.
        </p>
        <input
          id="sleeper-username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="e.g. fantasyjack"
          autoComplete="off"
          autoFocus
          className="mt-2 w-full rounded-lg border border-edge bg-surface-2 px-3 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:outline-none"
        />
        {error ? (
          <p role="alert" className="mt-2 text-left text-xs font-medium text-loss">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={busy !== null || username.trim().length === 0}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-bold uppercase tracking-wide text-accent-ink hover:opacity-90 disabled:opacity-50"
        >
          {busy === "connect" ? <Loader2 size={15} className="animate-spin" aria-hidden /> : null}
          Enter my Sunday
        </button>
      </form>

      <div className="my-4 flex items-center gap-3" aria-hidden>
        <span className="h-px flex-1 bg-edge" />
        <span className="text-[10px] font-bold tracking-wider text-ink-faint">OR</span>
        <span className="h-px flex-1 bg-edge" />
      </div>

      <button
        type="button"
        onClick={() => void enter(true)}
        disabled={busy !== null}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-warn/40 bg-warn/10 px-4 py-2.5 text-sm font-bold uppercase tracking-wide text-warn hover:bg-warn/20 disabled:opacity-50"
      >
        {busy === "simulate" ? <Loader2 size={15} className="animate-spin" aria-hidden /> : null}
        Simulate live Sunday
      </button>
      <p className="mt-2 text-center text-[11px] text-ink-faint">
        Your real leagues and rosters, dropped into a simulated mid-Sunday — scores, drives and
        stats all moving.
      </p>
    </div>
  );
}
