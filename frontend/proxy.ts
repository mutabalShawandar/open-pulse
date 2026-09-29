import { NextRequest, NextResponse } from "next/server";

import { authConfig, authEndpoints, isCanonicalPlatformHost, isOrganizationAppHost } from "@/lib/auth/config";
import { sessionCookieOptions, sessionCookies } from "@/lib/auth/session";

type TokenResponse = { access_token: string; refresh_token?: string; expires_in?: number; refresh_expires_in?: number };

// When NEXT_PUBLIC_ROOT_DOMAIN is set (e.g. "domain.de"), a request to
// "{workspace-slug}.domain.de/{public_slug}" is rewritten internally to
// "/respond/{public_slug}", so recipients answer surveys under a
// workspace-branded subdomain instead of the platform's own domain.
// Locally this also works out of the box via "*.localhost" when
// NEXT_PUBLIC_ROOT_DOMAIN=localhost.
export async function proxy(request: NextRequest) {
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
  const hostname = (request.headers.get("host") ?? "").split(":")[0].toLowerCase();
  const url = request.nextUrl.clone();
  const isRootDomain = !rootDomain || hostname === rootDomain || hostname === `www.${rootDomain}`;
  const organizationSlug = isOrganizationAppHost(hostname);
  const isPlatformHost = isCanonicalPlatformHost(hostname) || organizationSlug !== null;
  const isSubdomainSurvey = Boolean(rootDomain) && !isRootDomain && !isPlatformHost && hostname.endsWith(`.${rootDomain}`);
  const isPlatformSurvey = url.pathname.startsWith("/respond/");

  // Carried on the *request* headers (not response headers) so Server
  // Components can read it via next/headers on every "app.{org-slug}.{root}"
  // request; every return path below must forward it explicitly, since
  // NextResponse.next()/rewrite() only propagate request header changes when
  // passed a `{ request: { headers } }` override.
  const forwardedHeaders = new Headers(request.headers);
  if (organizationSlug) forwardedHeaders.set("x-organization-slug", organizationSlug);

  // Keycloak access tokens are deliberately short lived. Renew them server-side
  // before they expire, preserving the HTTP-only rotating refresh token too.
  // The session cookie is domain-wide (see lib/auth/session.ts) once
  // NEXT_PUBLIC_ROOT_DOMAIN is set, so this runs identically on the canonical
  // "app.{root}" host and on every "app.{org-slug}.{root}" host.
  if (isPlatformHost && !url.pathname.startsWith("/auth/") && shouldRefresh(request.cookies.get(sessionCookies.accessTokenCookie)?.value)) {
    const refreshToken = request.cookies.get(sessionCookies.refreshTokenCookie)?.value;
    const tokens = refreshToken ? await refreshAccessToken(refreshToken) : null;
    if (tokens) {
      const cookies = request.cookies.getAll().filter((cookie) => cookie.name !== sessionCookies.accessTokenCookie && cookie.name !== sessionCookies.refreshTokenCookie);
      cookies.push({ name: sessionCookies.accessTokenCookie, value: tokens.access_token });
      if (tokens.refresh_token) cookies.push({ name: sessionCookies.refreshTokenCookie, value: tokens.refresh_token });
      forwardedHeaders.set("cookie", cookies.map((cookie) => `${encodeURIComponent(cookie.name)}=${encodeURIComponent(cookie.value)}`).join("; "));

      const response = NextResponse.next({ request: { headers: forwardedHeaders } });
      response.cookies.set(sessionCookies.accessTokenCookie, tokens.access_token, sessionCookieOptions(tokens.expires_in));
      if (tokens.refresh_token) response.cookies.set(sessionCookies.refreshTokenCookie, tokens.refresh_token, sessionCookieOptions(tokens.refresh_expires_in ?? 60 * 60 * 24 * 14));
      return response;
    }
  }
  if (!isSubdomainSurvey && !isPlatformSurvey) return NextResponse.next({ request: { headers: forwardedHeaders } });

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

  if (isSubdomainSurvey && !url.pathname.startsWith("/respond/")) {
    url.pathname = `/respond${url.pathname}`;
  }
  return NextResponse.rewrite(url);
}

function shouldRefresh(accessToken: string | undefined) {
  if (!accessToken) return true;
  try {
    const payload = accessToken.split(".")[1];
    if (!payload) return true;
    const decoded = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(payload.length / 4) * 4, "="))) as { exp?: number };
    return !decoded.exp || decoded.exp * 1000 <= Date.now() + 60_000;
  } catch {
    return true;
  }
}

async function refreshAccessToken(refreshToken: string): Promise<TokenResponse | null> {
  const body = new URLSearchParams({ grant_type: "refresh_token", client_id: authConfig.keycloakClientId, refresh_token: refreshToken });
  if (authConfig.keycloakClientSecret) body.set("client_secret", authConfig.keycloakClientSecret);
  try {
    const response = await fetch(authEndpoints.token, { method: "POST", body, cache: "no-store" });
    return response.ok ? await response.json() as TokenResponse : null;
  } catch {
    return null;
  }
}

export const config = {
  matcher: ["/((?!_next/|api/|favicon.ico).*)"],
};
