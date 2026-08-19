import { NextRequest, NextResponse } from "next/server";
import { DEMO_COOKIE } from "@/lib/server/session";

export const dynamic = "force-dynamic";

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
};

/** Enter demo mode: sets the demo cookie and lands on the dashboard. */
export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/dashboard", request.url));
  response.cookies.set(DEMO_COOKIE, "1", COOKIE_OPTS);
  return response;
}

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(DEMO_COOKIE, "1", COOKIE_OPTS);
  return response;
}
