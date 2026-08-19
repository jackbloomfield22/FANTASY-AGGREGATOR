import { NextResponse } from "next/server";
import { computeResetOffset } from "@/lib/demo/simulation";
import { DEMO_EPOCH_COOKIE } from "@/lib/server/session";

export const dynamic = "force-dynamic";

/** Restart the demo simulation cycle from the beginning. */
export async function POST() {
  const offset = computeResetOffset(Date.now());
  const response = NextResponse.json({ ok: true });
  response.cookies.set(DEMO_EPOCH_COOKIE, String(offset), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
