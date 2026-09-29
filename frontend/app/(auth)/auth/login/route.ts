import { NextRequest, NextResponse } from "next/server";

import { authConfig, authEndpoints, isCanonicalPlatformHost, isOrganizationAppHost } from "@/lib/auth/config";
import { createChallenge, createState, createVerifier } from "@/lib/auth/pkce";
import { returnToCookie, returnToCookieOptions, sessionCookies } from "@/lib/auth/session";

const stateCookie = "umfrage_oauth_state";
const verifierCookie = "umfrage_pkce_verifier";

export async function GET(request: NextRequest) {
  const hostname = (request.headers.get("host") ?? "").split(":")[0].toLowerCase();

  // Keycloak's redirect URI only matches the single registered "app.{root}"
  // host exactly (no wildcard host segments), so a login started from an org
  // subdomain is bounced through the canonical host first; return_to (a
  // domain-wide cookie once NEXT_PUBLIC_ROOT_DOMAIN is set) carries the
  // originating subdomain back through to the callback.
  if (isOrganizationAppHost(hostname) && !isCanonicalPlatformHost(hostname)) {
    const originHeader = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
    const returnTo = `${originHeader}://${request.headers.get("host")}/`;
    const response = NextResponse.redirect(`${authConfig.appUrl}/auth/login`);
    response.cookies.set(returnToCookie, returnTo, returnToCookieOptions());
    return response;
  }

  const state = createState();
  const verifier = createVerifier();
  const challenge = await createChallenge(verifier);
  const callbackUrl = `${authConfig.appUrl}/auth/callback`;
  const authorizationUrl = new URL(authEndpoints.authorization);

  authorizationUrl.search = new URLSearchParams({
    client_id: authConfig.keycloakClientId,
    response_type: "code",
    redirect_uri: callbackUrl,
    scope: "openid profile email",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  }).toString();

  const response = NextResponse.redirect(authorizationUrl);
  const options = { ...sessionCookies.cookieOptions, maxAge: 600 };
  response.cookies.set(stateCookie, state, options);
  response.cookies.set(verifierCookie, verifier, options);
  return response;
}
