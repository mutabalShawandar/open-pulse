import { NextRequest, NextResponse } from "next/server";

// When NEXT_PUBLIC_ROOT_DOMAIN is set (e.g. "domain.de"), a request to
// "{clinic-slug}.domain.de/{public_slug}" is rewritten internally to
// "/umfragen/{public_slug}", so recipients answer surveys under a
// clinic-branded subdomain instead of the platform's own domain.
// Locally this also works out of the box via "*.localhost" when
// NEXT_PUBLIC_ROOT_DOMAIN=localhost.
export function proxy(request: NextRequest) {
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
  const hostname = (request.headers.get("host") ?? "").split(":")[0].toLowerCase();
  const url = request.nextUrl.clone();
  const isRootDomain = !rootDomain || hostname === rootDomain || hostname === `www.${rootDomain}`;
  const isSubdomainSurvey = Boolean(rootDomain) && !isRootDomain && hostname.endsWith(`.${rootDomain}`);
  const isPlatformSurvey = url.pathname.startsWith("/umfragen/");
  if (!isSubdomainSurvey && !isPlatformSurvey) return NextResponse.next();

  const recipientToken = url.searchParams.get("token");
  if (recipientToken) {
    const cleanUrl = request.nextUrl.clone();
    cleanUrl.searchParams.delete("token");
    const response = NextResponse.redirect(cleanUrl);
    const pathSegments = url.pathname.split("/").filter(Boolean);
    const pathSegment = pathSegments[pathSegments.length - 1] ?? "survey";
    const cookieName = `survey_access_${pathSegment.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
    response.cookies.set(cookieName, recipientToken, {
      httpOnly: true,
      secure: cleanUrl.protocol === "https:",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });
    return response;
  }

  if (isSubdomainSurvey && !url.pathname.startsWith("/umfragen/")) {
    url.pathname = `/umfragen${url.pathname}`;
  }
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!_next/|api/|favicon.ico).*)"],
};
