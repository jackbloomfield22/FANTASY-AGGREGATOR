"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DataGate } from "@/components/DataGate";
import { PageHeader } from "@/components/PageHeader";
import { SleeperConnectCard } from "@/components/SleeperConnectCard";
import { usePortfolio } from "@/components/providers/PortfolioProvider";
import { useDisplayPrefs, type ThemePref } from "@/components/providers/displayPrefs";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="space-y-2">
      <h2 className="text-[11px] font-bold tracking-[0.14em] text-ink-faint">{title.toUpperCase()}</h2>
      {children}
    </section>
  );
}

function ComingSoonCard({ name, note }: { name: string; note: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-edge bg-surface p-4 opacity-80">
      <div>
        <p className="text-sm font-bold text-ink">{name}</p>
        <p className="text-xs text-ink-dim">{note}</p>
      </div>
      <span className="rounded border border-edge bg-surface-2 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-ink-faint">
        COMING SOON
      </span>
    </div>
  );
}

export default function SettingsPage() {
  const router = useRouter();
  const { refresh, snapshot } = usePortfolio();
  const { theme, setTheme, compactCards, setCompactCards } = useDisplayPrefs();
  const [email, setEmail] = useState<string | null>(null);
  const [resetNotice, setResetNotice] = useState<string | null>(null);

  useEffect(() => {
    track("settings_viewed");
    const supabase = createSupabaseBrowserClient();
    if (supabase) {
      void supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    }
  }, []);

  const resetDemo = async () => {
    await fetch("/api/demo/reset", { method: "POST" });
    setResetNotice("Demo simulation restarted from kickoff.");
    await refresh();
  };

  const logOut = async () => {
    const supabase = createSupabaseBrowserClient();
    if (supabase) await supabase.auth.signOut();
    await fetch("/api/demo/exit", { method: "POST" });
    await fetch("/api/connections/sleeper", { method: "DELETE" });
    router.push("/");
    router.refresh();
  };

  const yahooConnection = snapshot?.meta.connections.find((c) => c.provider === "yahoo");

  return (
    <DataGate>
      {(_, snap) => (
        <div className="max-w-2xl space-y-6">
          <PageHeader title="Settings" />

          <Section title="Fantasy connections">
            <SleeperConnectCard />
            <ComingSoonCard
              name="Yahoo"
              note={
                yahooConnection?.status === "needs_config"
                  ? "Requires YAHOO_CLIENT_ID / YAHOO_CLIENT_SECRET server configuration."
                  : "Yahoo OAuth connection."
              }
            />
            <ComingSoonCard name="ESPN" note="No supported public API yet — we don't scrape." />
            <ComingSoonCard name="NFL Fantasy" note="Planned after Yahoo." />
          </Section>

          <Section title="Display">
            <div className="rounded-xl border border-edge bg-surface p-4">
              <p className="mb-2 text-sm font-semibold text-ink">Theme</p>
              <div role="radiogroup" aria-label="Theme" className="flex gap-2">
                {(["dark", "light", "system"] as ThemePref[]).map((t) => (
                  <button
                    key={t}
                    role="radio"
                    aria-checked={theme === t}
                    type="button"
                    onClick={() => setTheme(t)}
                    className={cn(
                      "rounded-md border px-3 py-1.5 text-xs font-semibold capitalize",
                      theme === t
                        ? "border-accent bg-accent text-accent-ink"
                        : "border-edge bg-surface-2 text-ink-dim hover:text-ink"
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <label className="mt-4 flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-ink">Compact player cards</span>
                <input
                  type="checkbox"
                  checked={compactCards}
                  onChange={(e) => setCompactCards(e.target.checked)}
                  className="h-4 w-4 accent-[var(--accent)]"
                />
              </label>
            </div>
          </Section>

          <Section title="Data">
            <div className="flex flex-wrap gap-2 rounded-xl border border-edge bg-surface p-4">
              <button
                type="button"
                onClick={() => void refresh(true)}
                className="rounded-md border border-edge bg-surface-2 px-3 py-1.5 text-xs font-semibold text-ink hover:bg-surface-3"
              >
                Refresh connections
              </button>
              {snap.meta.mode === "demo" ? (
                <button
                  type="button"
                  onClick={() => void resetDemo()}
                  className="rounded-md border border-edge bg-surface-2 px-3 py-1.5 text-xs font-semibold text-ink hover:bg-surface-3"
                >
                  Reset demo data
                </button>
              ) : null}
              {resetNotice ? <p className="w-full text-xs font-medium text-win">{resetNotice}</p> : null}
            </div>
          </Section>

          <Section title="Account">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-edge bg-surface p-4">
              <div>
                <p className="text-sm font-semibold text-ink">{email ?? "Demo session"}</p>
                <p className="text-xs text-ink-dim">
                  {email
                    ? "Signed in with Supabase"
                    : snap.meta.mode === "demo"
                      ? "You're exploring with demo data."
                      : "Connected via Sleeper (no account required)."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void logOut()}
                className="rounded-md border border-loss/40 bg-loss/10 px-3 py-1.5 text-xs font-bold text-loss hover:bg-loss/20"
              >
                {email ? "Log out" : "Exit & clear session"}
              </button>
            </div>
          </Section>
        </div>
      )}
    </DataGate>
  );
}
