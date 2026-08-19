"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Home, Users, Trophy, Tv, Settings, Search, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePortfolio, useSecondsSinceUpdate } from "@/components/providers/PortfolioProvider";
import { SearchModal } from "@/components/SearchModal";
import { LiveIndicator } from "@/components/ui/badges";

const NAV = [
  { href: "/dashboard", label: "Home", icon: Home },
  { href: "/players", label: "Players", icon: Users },
  { href: "/teams", label: "Teams", icon: Trophy },
  { href: "/games", label: "NFL Games", icon: Tv },
  { href: "/settings", label: "Settings", icon: Settings },
];

function NavLink({
  href,
  label,
  icon: Icon,
  variant,
}: {
  href: string;
  label: string;
  icon: typeof Home;
  variant: "side" | "bottom";
}) {
  const pathname = usePathname();
  const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(href));
  if (variant === "bottom") {
    return (
      <Link
        href={href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex min-w-0 flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-semibold",
          active ? "text-accent" : "text-ink-faint hover:text-ink-dim"
        )}
      >
        <Icon size={20} strokeWidth={active ? 2.4 : 2} aria-hidden />
        {label}
      </Link>
    );
  }
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
        active ? "bg-surface-3 text-ink" : "text-ink-dim hover:bg-surface-2 hover:text-ink"
      )}
    >
      <Icon size={17} aria-hidden />
      {label}
    </Link>
  );
}

function RefreshControl({ compact = false }: { compact?: boolean }) {
  const { refresh, loading } = usePortfolio();
  const seconds = useSecondsSinceUpdate();
  return (
    <button
      type="button"
      onClick={() => void refresh(true)}
      className="flex items-center gap-1.5 rounded-md border border-edge bg-surface-2 px-2 py-1.5 text-[11px] font-medium text-ink-dim transition-colors hover:bg-surface-3 hover:text-ink"
      aria-label="Refresh live data"
    >
      <RefreshCw size={13} className={cn(loading && "animate-spin")} aria-hidden />
      {!compact && (
        <span className="tnum">
          {seconds === null ? "Refresh" : seconds < 5 ? "Updated just now" : `Updated ${seconds} sec ago`}
        </span>
      )}
    </button>
  );
}

function ModeBadge() {
  const { snapshot } = usePortfolio();
  if (!snapshot) return null;
  if (snapshot.meta.mode === "demo") {
    return (
      <span
        title="You're viewing simulated demo data. Connect a fantasy account in Settings for real data."
        className="inline-flex items-center gap-1.5 rounded-md border border-warn/40 bg-warn/10 px-2 py-1 text-[10px] font-bold tracking-wider text-warn"
      >
        <span aria-hidden className="live-dot inline-block h-1.5 w-1.5 rounded-full bg-warn" />
        DEMO LIVE
      </span>
    );
  }
  if (snapshot.meta.liveSource === "none") {
    return (
      <span
        title="Fantasy data is real (Sleeper). No live NFL data provider is configured — set SPORTRADAR_API_KEY for live game detail."
        className="inline-flex items-center rounded-md border border-edge bg-surface-2 px-2 py-1 text-[10px] font-bold tracking-wider text-ink-dim"
      >
        NO LIVE FEED
      </span>
    );
  }
  return <LiveIndicator />;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="min-h-dvh bg-bg">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 flex-col border-r border-edge bg-surface px-3 py-4 md:flex">
        <Link href="/dashboard" className="mb-6 flex items-center gap-2 px-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-xs font-black text-accent-ink">
            FA
          </span>
          <span className="text-sm font-bold tracking-wide text-ink">Fantasy Aggregator</span>
        </Link>
        <nav aria-label="Primary" className="flex flex-1 flex-col gap-1">
          {NAV.map((item) => (
            <NavLink key={item.href} {...item} variant="side" />
          ))}
        </nav>
        <div className="flex flex-col gap-2 px-1">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2 rounded-lg border border-edge bg-surface-2 px-3 py-2 text-sm text-ink-faint transition-colors hover:bg-surface-3 hover:text-ink"
          >
            <Search size={15} aria-hidden />
            Search
            <kbd className="ml-auto rounded border border-edge px-1 text-[10px] text-ink-faint">⌘K</kbd>
          </button>
          <div className="flex items-center justify-between gap-2">
            <ModeBadge />
            <RefreshControl compact />
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-edge bg-surface/95 px-4 py-2.5 backdrop-blur md:hidden">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent text-[10px] font-black text-accent-ink">
            FA
          </span>
          <span className="text-sm font-bold text-ink">Fantasy Aggregator</span>
        </Link>
        <div className="flex items-center gap-1.5">
          <ModeBadge />
          <RefreshControl compact />
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            aria-label="Search"
            className="rounded-md border border-edge bg-surface-2 p-1.5 text-ink-dim hover:text-ink"
          >
            <Search size={15} aria-hidden />
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="px-4 pb-24 pt-4 md:ml-56 md:px-8 md:pb-10 md:pt-6">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>

      {/* Mobile bottom nav */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-edge bg-surface/95 backdrop-blur md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {NAV.map((item) => (
          <NavLink key={item.href} {...item} variant="bottom" />
        ))}
      </nav>

      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
