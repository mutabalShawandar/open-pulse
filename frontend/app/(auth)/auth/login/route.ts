import { NextResponse } from "next/server";

import { authConfig, authEndpoints } from "@/lib/auth/config";
import { createChallenge, createState, createVerifier } from "@/lib/auth/pkce";
import { sessionCookies } from "@/lib/auth/session";

const stateCookie = "umfrage_oauth_state";
const verifierCookie = "umfrage_pkce_verifier";

export async function GET() {
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
