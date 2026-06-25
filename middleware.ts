import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const PUBLIC = ["/login", "/signup", "/configure"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const res = NextResponse.next();

  const configured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );

  // Hard gate: no Supabase env -> everything routes to /configure
  if (!configured) {
    if (pathname === "/configure") return res;
    const url = req.nextUrl.clone();
    url.pathname = "/configure";
    return NextResponse.redirect(url);
  }

  // Supabase configured: refresh session
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublic = PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/"));
  const isApi = pathname.startsWith("/api/");
  const isAsset =
    pathname.startsWith("/_next/") ||
    pathname.includes(".");

  if (!user && !isPublic && !isApi && !isAsset) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (user && (pathname === "/login" || pathname === "/signup" || pathname === "/configure")) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
