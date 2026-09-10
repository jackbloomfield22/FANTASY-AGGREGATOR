"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { track } from "@/lib/analytics";

/**
 * The front door: enter a Sleeper username to step straight into your real
 * portfolio. Shown to everyone without a session.
 */
export function EntryGate() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enter = async () => {
    if (username.trim().length === 0) {
      setError("Enter your Sleeper username first.");
      return;
    }
    setBusy(true);
    setError(null);
    track("fantasy_connection_started", { provider: "sleeper", from: "entry" });
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
      track("fantasy_connection_completed", { provider: "sleeper", from: "entry" });
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Network error reaching Sleeper — try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full max-w-sm rounded-2xl border border-edge bg-surface p-6 shadow-2xl">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void enter();
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
          disabled={busy || username.trim().length === 0}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-bold uppercase tracking-wide text-accent-ink hover:opacity-90 disabled:opacity-50"
        >
          {busy ? <Loader2 size={15} className="animate-spin" aria-hidden /> : null}
          Enter my Sunday
        </button>
      </form>

      <p className="mt-3 text-center text-[11px] text-ink-faint">
        Your leagues, rosters, matchups and live scoring — all in one place, all season long.
      </p>
    </div>
  );
}
