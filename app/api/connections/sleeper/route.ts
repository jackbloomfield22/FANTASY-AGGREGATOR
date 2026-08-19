import { NextRequest, NextResponse } from "next/server";
import { sleeperProvider } from "@/lib/providers/fantasy/sleeper";
import { FantasyProviderError } from "@/lib/providers/fantasy/base";
import { SLEEPER_COOKIE } from "@/lib/server/session";

export const dynamic = "force-dynamic";

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 90,
};

/**
 * Connect a Sleeper account by username. Validates the user exists and has
 * leagues this season before storing the connection.
 */
export async function POST(request: NextRequest) {
  let username: unknown;
  try {
    ({ username } = await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (typeof username !== "string" || !/^[a-zA-Z0-9_]{1,32}$/.test(username.trim())) {
    return NextResponse.json(
      { error: "Enter a valid Sleeper username (letters, numbers, underscores)." },
      { status: 400 }
    );
  }

  try {
    const sync = await sleeperProvider.syncUserFantasyData(username.trim());
    const response = NextResponse.json({
      ok: true,
      user: sync.user,
      leagues: sync.leagues.map((l) => ({ id: l.id, name: l.name })),
      week: sync.week,
      season: sync.season,
      warnings: sync.warnings,
    });
    response.cookies.set(
      SLEEPER_COOKIE,
      JSON.stringify({
        username: sync.user.username,
        userId: sync.user.providerUserId,
        displayName: sync.user.displayName,
        connectedAt: new Date().toISOString(),
        lastSyncedAt: sync.syncedAt,
      }),
      COOKIE_OPTS
    );
    return response;
  } catch (err) {
    if (err instanceof FantasyProviderError) {
      const status =
        err.code === "user_not_found" || err.code === "no_leagues"
          ? 404
          : err.code === "rate_limited"
            ? 429
            : 502;
      return NextResponse.json({ error: err.message, code: err.code }, { status });
    }
    return NextResponse.json({ error: "Failed to connect Sleeper." }, { status: 502 });
  }
}

/** Disconnect Sleeper. */
export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(SLEEPER_COOKIE);
  return response;
}
