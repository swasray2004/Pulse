import { NextResponse, type NextRequest } from "next/server";
import { unsealData, sessionOptions, SessionData } from "@/lib/session";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const cookie = request.cookies.get(sessionOptions.cookieName)?.value;
  let isAuthenticated = false;

  if (cookie) {
    try {
      const session = await unsealData<SessionData>(cookie, {
        password: sessionOptions.password,
      });
      if (session?.userId) {
        isAuthenticated = true;
      }
    } catch {
      isAuthenticated = false;
    }
  }

  // If already authenticated and trying to access login/signup, redirect to /
  if (pathname === "/login" || pathname === "/signup") {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  // Protected routes
  const isProtectedRoute =
    pathname === "/" ||
    pathname.startsWith("/watchlist") ||
    pathname.startsWith("/away") ||
    pathname.startsWith("/replay") ||
    pathname.startsWith("/preferences") ||
    pathname.startsWith("/stock");

  if (isProtectedRoute && !isAuthenticated) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") {
      loginUrl.searchParams.set("from", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)",
    "/",
  ],
};
