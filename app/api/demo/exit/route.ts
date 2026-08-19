import { NextResponse } from "next/server";
import { DEMO_COOKIE, DEMO_EPOCH_COOKIE } from "@/lib/server/session";

export const dynamic = "force-dynamic";

/** Leave demo mode (clears demo cookies). */
export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete(DEMO_COOKIE);
  response.cookies.delete(DEMO_EPOCH_COOKIE);
  return response;
}
