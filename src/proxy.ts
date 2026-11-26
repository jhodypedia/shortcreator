import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth";

const PUBLIC_PATHS = ["/login", "/setup"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    PUBLIC_PATHS.includes(pathname) ||
    pathname.startsWith("/_next/") ||
    pathname === "/_next" ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    /\.[^/]+$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    if (pathname.startsWith("/api/auth/")) return NextResponse.next();

    // Worker jobs can trigger rendering with a server-only secret. Browser
    // requests to the same route still require an admin session.
    if (
      pathname.startsWith("/api/render/") &&
      process.env.WORKER_SECRET &&
      request.headers.get("x-worker-secret") === process.env.WORKER_SECRET
    ) {
      return NextResponse.next();
    }

    const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    let validSession = false;
    try {
      validSession = Boolean(token && verifySessionToken(token));
    } catch {
      validSession = false;
    }
    if (!validSession) {
      return NextResponse.json({ error: "Silakan masuk untuk melanjutkan." }, { status: 401 });
    }
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  let validSession = false;
  try {
    validSession = Boolean(token && verifySessionToken(token));
  } catch {
    validSession = false;
  }
  if (validSession) return NextResponse.next();

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
