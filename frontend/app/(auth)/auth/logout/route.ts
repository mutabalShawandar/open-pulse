import { NextRequest, NextResponse } from "next/server";

import { sessionCookies } from "@/lib/auth/session";

export function POST(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/login", request.url));
  response.cookies.delete(sessionCookies.accessTokenCookie);
  response.cookies.delete(sessionCookies.refreshTokenCookie);
  return response;
}
