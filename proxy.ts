import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/players",
  "/teams",
  "/games",
  "/settings",
  "/onboarding",
];

/**
 * Route protection:
 *  - demo cookie (fa-demo=1) grants access without Supabase
 *  - a Sleeper connection cookie also grants access
 *  - otherwise, a Supabase session is required (when configured)
 *  - with nothing at all, protected routes redirect to the landing page
 */
export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));

  let response = NextResponse.next({ request });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let hasSupabaseSession = false;
  if (supabaseUrl && supabaseKey) {
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    });
    const {
      data: { user },
    } = await supabase.auth.getUser();
    hasSupabaseSession = Boolean(user);
  }

  if (!isProtected) return response;

  const hasDemo = request.cookies.get("fa-demo")?.value === "1";
  const hasSleeper = Boolean(request.cookies.get("fa-sleeper")?.value);

  if (hasDemo || hasSleeper || hasSupabaseSession) return response;

  const url = request.nextUrl.clone();
  url.pathname = "/";
  url.searchParams.set("from", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
