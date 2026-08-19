import { NextResponse } from "next/server";
import { sleeperProvider } from "@/lib/providers/fantasy/sleeper";
import { FantasyProviderError } from "@/lib/providers/fantasy/base";
import { getSleeperConnection, SLEEPER_COOKIE } from "@/lib/server/session";

export const dynamic = "force-dynamic";

/**
 * Manual "Sync Now" for the connected Sleeper account. Idempotent — the
 * provider's short-lived caches make duplicate syncs cheap, and normalized
 * IDs mean repeats never duplicate leagues, teams or players.
 */
export async function POST() {
  const connection = await getSleeperConnection();
  if (!connection) {
    return NextResponse.json({ error: "No Sleeper account connected." }, { status: 400 });
  }
  try {
    const sync = await sleeperProvider.syncUserFantasyData(connection.username);
    const response = NextResponse.json({
      ok: true,
      syncedAt: sync.syncedAt,
      leagues: sync.leagues.length,
      warnings: sync.warnings,
    });
    response.cookies.set(
      SLEEPER_COOKIE,
      JSON.stringify({ ...connection, lastSyncedAt: sync.syncedAt }),
      { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 90 }
    );
    return response;
  } catch (err) {
    if (err instanceof FantasyProviderError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 502 });
    }
    return NextResponse.json({ error: "Sync failed." }, { status: 502 });
  }
}
