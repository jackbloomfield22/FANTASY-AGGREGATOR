"use client";

import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { SleeperConnectCard } from "@/components/SleeperConnectCard";
import { track } from "@/lib/analytics";

function ComingSoonProvider({ name, note }: { name: string; note: string }) {
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

export default function OnboardingPage() {
  const router = useRouter();

  const exploreDemo = async () => {
    track("demo_started");
    await fetch("/api/demo/enter", { method: "POST" });
    router.push("/dashboard");
    router.refresh();
  };

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <PageHeader
        title="Connect your fantasy leagues"
        subtitle="Step 1 — link the platforms where you play. Sleeper works today; more are on the way."
      />

      <SleeperConnectCard onConnected={() => router.push("/dashboard")} />
      <ComingSoonProvider name="ESPN" note="No supported public API yet — we don't scrape or fake it." />
      <ComingSoonProvider name="Yahoo" note="OAuth integration lands once credentials are configured." />
      <ComingSoonProvider name="NFL Fantasy" note="Planned after Yahoo." />

      <div className="rounded-xl border border-dashed border-edge bg-surface p-4 text-center">
        <p className="text-sm font-semibold text-ink">Not ready to connect anything?</p>
        <p className="mt-0.5 text-xs text-ink-dim">
          Explore the full product with a realistic simulated Sunday — five leagues, live games,
          red-zone alerts.
        </p>
        <button
          type="button"
          onClick={() => void exploreDemo()}
          className="mt-3 rounded-md border border-edge bg-surface-2 px-4 py-2 text-xs font-bold uppercase tracking-wide text-ink hover:bg-surface-3"
        >
          Explore with demo data
        </button>
      </div>
    </div>
  );
}
