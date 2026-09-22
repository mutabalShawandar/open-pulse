import { NextRequest, NextResponse } from "next/server";

// When NEXT_PUBLIC_ROOT_DOMAIN is set (e.g. "domain.de"), a request to
// "{clinic-slug}.domain.de/{public_slug}" is rewritten internally to
// "/umfragen/{public_slug}", so recipients answer surveys under a
// clinic-branded subdomain instead of the platform's own domain.
// Locally this also works out of the box via "*.localhost" when
// NEXT_PUBLIC_ROOT_DOMAIN=localhost.
export function proxy(request: NextRequest) {
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
  if (!rootDomain) return NextResponse.next();

  const hostname = (request.headers.get("host") ?? "").split(":")[0].toLowerCase();
  if (hostname === rootDomain || hostname === `www.${rootDomain}`) return NextResponse.next();
  if (!hostname.endsWith(`.${rootDomain}`)) return NextResponse.next();

  const subdomain = hostname.slice(0, -(`.${rootDomain}`.length));
  if (!subdomain || subdomain === "www") return NextResponse.next();

  const url = request.nextUrl.clone();
  if (!url.pathname.startsWith("/umfragen/")) {
    url.pathname = `/umfragen${url.pathname}`;
  }
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!_next/|api/|favicon.ico).*)"],
};
