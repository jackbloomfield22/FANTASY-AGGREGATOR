import { NextResponse } from "next/server";
import { SIM_LIVE_COOKIE } from "@/lib/server/session";

export const dynamic = "force-dynamic";

/** Toggle the simulated live Sunday over real fantasy rosters. */
export async function POST() {
  const response = NextResponse.json({ ok: true, simulated: true });
  response.cookies.set(SIM_LIVE_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true, simulated: false });
  response.cookies.delete(SIM_LIVE_COOKIE);
  return response;
}
