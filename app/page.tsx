import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { DEMO_COOKIE, SLEEPER_COOKIE } from "@/lib/server/session";
import { EntryGate } from "@/components/EntryGate";

export const dynamic = "force-dynamic";

/**
 * The front door. Anyone without a session lands here and enters through
 * one window: Sleeper username, or demo mode. Existing sessions go straight
 * to the dashboard.
 */
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

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center px-6 py-10 text-center">
        <p className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-edge bg-surface px-3 py-1 text-[11px] font-semibold tracking-wide text-ink-dim">
          <span aria-hidden className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-live" />
          Built for NFL Sunday
        </p>
        <h1 className="text-3xl font-black uppercase leading-tight tracking-tight text-ink sm:text-4xl">
          Every league. Every player.
          <br />
          <span className="text-accent">One Sunday.</span>
        </h1>
        <p className="mt-3 max-w-md text-sm text-ink-dim">
          See every player you roster, every matchup you&apos;re playing, and every NFL moment
          that matters to you — all in one place.
        </p>

        <div className="mt-8 w-full max-w-sm">
          <EntryGate />
        </div>
      </main>

      <footer className="px-6 py-4 text-center text-[11px] text-ink-faint">
        Not affiliated with the NFL, ESPN, Yahoo or Sleeper. Demo data is fictional.
      </footer>
    </div>
  );
}
