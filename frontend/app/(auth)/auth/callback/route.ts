import { NextRequest, NextResponse } from "next/server";

import { authConfig, authEndpoints, isCanonicalPlatformHost, isOrganizationAppHost } from "@/lib/auth/config";
import { getCurrentUser } from "@/lib/api/client";
import { returnToCookie, sessionCookieOptions, sessionCookies } from "@/lib/auth/session";

const stateCookie = "umfrage_oauth_state";
const verifierCookie = "umfrage_pkce_verifier";

type TokenResponse = { access_token: string; refresh_token?: string; expires_in?: number; refresh_expires_in?: number };

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const returnedState = request.nextUrl.searchParams.get("state");
  const expectedState = request.cookies.get(stateCookie)?.value;
  const verifier = request.cookies.get(verifierCookie)?.value;

  if (!code || !returnedState || returnedState !== expectedState || !verifier) {
    return clearTemporaryCookies(NextResponse.redirect(appUrl("/login?error=callback")));
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: authConfig.keycloakClientId,
    code,
    redirect_uri: `${authConfig.appUrl}/auth/callback`,
    code_verifier: verifier,
  });
  if (authConfig.keycloakClientSecret) body.set("client_secret", authConfig.keycloakClientSecret);

  const tokenResponse = await fetch(authEndpoints.token, { method: "POST", body, cache: "no-store" });
  if (!tokenResponse.ok) return clearTemporaryCookies(NextResponse.redirect(appUrl("/login?error=token")));

  const tokens = (await tokenResponse.json()) as TokenResponse;
  try {
    const user = await getCurrentUser(tokens.access_token);
    if (!user.is_active) return clearTemporaryCookies(NextResponse.redirect(appUrl("/access-denied")));
  } catch {
    return clearTemporaryCookies(NextResponse.redirect(appUrl("/access-denied")));
  }

  const response = clearTemporaryCookies(NextResponse.redirect(resolveReturnTo(request) ?? appUrl("/")));
  response.cookies.set(sessionCookies.accessTokenCookie, tokens.access_token, sessionCookieOptions(tokens.expires_in));
  if (tokens.refresh_token) response.cookies.set(sessionCookies.refreshTokenCookie, tokens.refresh_token, sessionCookieOptions(tokens.refresh_expires_in ?? 60 * 60 * 24 * 14));
  response.cookies.delete(returnToCookie);
  return response;
}

function appUrl(path: string): URL {
  return new URL(path, authConfig.appUrl);
}

// return_to is attacker-influenceable in principle (it's a cookie the browser
// sends), so it's only ever honored when it parses as an http(s) URL whose
// host is the canonical platform host or a real "app.{org-slug}.{root}" host
// — never an arbitrary redirect target.
function resolveReturnTo(request: NextRequest): URL | null {
  const value = request.cookies.get(returnToCookie)?.value;
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (isCanonicalPlatformHost(url.hostname) || isOrganizationAppHost(url.hostname)) return url;
    return null;
  } catch {
    return null;
  }
}

function clearTemporaryCookies(response: NextResponse) {
  response.cookies.delete(stateCookie);
  response.cookies.delete(verifierCookie);
  return response;
}
