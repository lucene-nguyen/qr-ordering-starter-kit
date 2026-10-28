import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Runs before every /staff/* request: refreshes the Supabase session cookie and sends
 * signed-out visitors to the sign-in page. Only "signed in or not" is checked here; the role is
 * checked by each page and Server Action (requireStaff), because proxy should not query the DB.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet, headers) => {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value)); // no CDN caching of sessions
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims(); // verifies the JWT, refreshing it if needed
  const { pathname } = request.nextUrl;
  if (!data?.claims && pathname !== "/staff/sign-in") {
    const url = new URL("/staff/sign-in", request.url);
    url.searchParams.set("next", pathname);
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c)); // keep cleared/refreshed cookies
    return redirect;
  }
  return response;
}

export const config = { matcher: "/staff/:path*" };
