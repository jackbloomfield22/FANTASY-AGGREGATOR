import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { DEMO_COOKIE, SLEEPER_COOKIE } from "@/lib/server/session";

export const dynamic = "force-dynamic";

/** Landing: marketing/auth entry when logged out; straight to the app otherwise. */
export default async function LandingPage() {
  const store = await cookies();
  const hasDemo = store.get(DEMO_COOKIE)?.value === "1";
  const hasSleeper = Boolean(store.get(SLEEPER_COOKIE)?.value);
  const user = await getAuthenticatedUser();
  if (hasDemo || hasSleeper || user) redirect("/dashboard");

  const supabaseReady = isSupabaseConfigured();

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-xs font-black text-accent-ink">
            FA
          </span>
          <span className="text-sm font-bold text-ink">Fantasy Aggregator</span>
        </div>
        {supabaseReady ? (
          <Link
            href="/login"
            className="rounded-md border border-edge bg-surface-2 px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-3"
          >
            Log in
          </Link>
        ) : null}
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center px-6 py-12 text-center">
        <p className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-edge bg-surface px-3 py-1 text-[11px] font-semibold tracking-wide text-ink-dim">
          <span aria-hidden className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-live" />
          Built for NFL Sunday
        </p>
        <h1 className="text-4xl font-black uppercase leading-tight tracking-tight text-ink sm:text-5xl">
          Every league.
          <br />
          Every player.
          <br />
          <span className="text-accent">One Sunday.</span>
        </h1>
        <p className="mt-4 max-w-xl text-base text-ink-dim">
          Connect your fantasy football leagues and see every player you roster, every matchup
          you&apos;re playing, and every NFL moment that matters to you — all in one place.
        </p>
        <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
          <Link
            href={supabaseReady ? "/signup" : "/api/demo/enter"}
            className="rounded-lg bg-accent px-6 py-3 text-sm font-bold uppercase tracking-wide text-accent-ink hover:opacity-90"
          >
            Get started
          </Link>
          <a
            href="/api/demo/enter"
            className="rounded-lg border border-edge bg-surface-2 px-6 py-3 text-sm font-bold uppercase tracking-wide text-ink hover:bg-surface-3"
          >
            Explore demo
          </a>
        </div>

        {/* Product preview: Players / Teams at a glance */}
        <div className="mt-14 grid w-full gap-3 text-left sm:grid-cols-2">
          <div className="rounded-xl border border-edge bg-surface p-4">
            <p className="mb-2 text-[10px] font-bold tracking-[0.14em] text-ink-faint">PLAYERS — YOUR PORTFOLIO</p>
            <p className="text-sm font-bold uppercase text-ink">Marcus Reed <span className="text-xs font-medium normal-case text-ink-dim">WR · LAR</span></p>
            <p className="tnum mt-1 text-xs text-ink-dim">LAR 20 — SEA 17 · 3rd · 4:22 · 7 REC · 94 YDS · 1 TD</p>
            <p className="tnum mt-2 text-xs font-bold text-win">+44.8 portfolio pts · Starting 2 of 5 leagues</p>
            <p className="mt-2 text-[11px] font-bold tracking-wider text-redzone">LAR BALL — SEA 08 · RED ZONE</p>
          </div>
          <div className="rounded-xl border border-edge bg-surface p-4">
            <p className="mb-2 text-[10px] font-bold tracking-[0.14em] text-ink-faint">TEAMS — AM I WINNING?</p>
            <div className="space-y-2">
              {[
                { league: "The Office League", score: "117.4 — 103.8", label: "64% WIN", cls: "text-win" },
                { league: "Dynasty Empire", score: "89.2 — 112.1", label: "18% WIN", cls: "text-loss" },
                { league: "Friends League", score: "121.8 — 119.4", label: "TOSS UP", cls: "text-warn" },
              ].map((m) => (
                <p key={m.league} className="flex items-center justify-between text-xs">
                  <span className="font-medium text-ink-dim">{m.league}</span>
                  <span className="tnum font-bold text-ink">{m.score}</span>
                  <span className={`tnum font-bold ${m.cls}`}>{m.label}</span>
                </p>
              ))}
            </div>
          </div>
        </div>
      </main>

      <footer className="px-6 py-4 text-center text-[11px] text-ink-faint">
        Not affiliated with the NFL, ESPN, Yahoo or Sleeper. Demo data is fictional.
      </footer>
    </div>
  );
}
