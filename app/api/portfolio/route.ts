import { NextResponse } from "next/server";
import { getPortfolioSnapshot } from "@/lib/server/portfolio";

export const dynamic = "force-dynamic";

/**
 * The single snapshot endpoint the client polls. Everything the UI needs —
 * leagues, rosters, canonical players, games, raw stats, alerts — arrives in
 * one batched payload; no per-player requests.
 */
export async function GET() {
  try {
    const snapshot = await getPortfolioSnapshot();
    return NextResponse.json(snapshot, {
      headers: { "cache-control": "no-store" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to build portfolio snapshot.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
