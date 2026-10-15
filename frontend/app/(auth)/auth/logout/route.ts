import { NextRequest, NextResponse } from "next/server";

import { authConfig, authEndpoints } from "@/lib/auth/config";
import { sessionCookies } from "@/lib/auth/session";

// Clearing our own cookies alone leaves the Keycloak SSO session alive, so the
// next "Sign in" would log straight back in without credentials. After clearing
// them we therefore send the browser through Keycloak's end-session endpoint,
// which returns to /login (registered in the client's post.logout.redirect.uris).
export function POST(request: NextRequest) {
  const endSession = new URL(authEndpoints.endSession);
  endSession.searchParams.set("client_id", authConfig.keycloakClientId);
  endSession.searchParams.set("post_logout_redirect_uri", `${authConfig.appUrl}/login`);
  const idToken = request.cookies.get(sessionCookies.idTokenCookie)?.value;
  if (idToken) endSession.searchParams.set("id_token_hint", idToken);

  // 303 so the browser follows with GET, which the end-session endpoint expects.
  const response = NextResponse.redirect(endSession, 303);
  // Match the attributes the cookies were set with: with NEXT_PUBLIC_ROOT_DOMAIN
  // they are domain-wide, and a delete without that domain would not remove them.
  for (const name of [sessionCookies.accessTokenCookie, sessionCookies.refreshTokenCookie, sessionCookies.idTokenCookie]) {
    response.cookies.set(name, "", { ...sessionCookies.cookieOptions, maxAge: 0 });
  }
  return response;
}
