import { cookies } from "next/headers";

const accessTokenCookie = "umfrage_access_token";
const refreshTokenCookie = "umfrage_refresh_token";
const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
// Shared across "app.{root}" and every "app.{org-slug}.{root}" subdomain so a
// session established on the canonical host (see lib/auth/config.ts) is
// already valid once the browser is bounced back to an org subdomain.
// Secure is mandatory once the cookie is domain-wide, not just in production.
const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production" || Boolean(rootDomain),
  path: "/",
  ...(rootDomain ? { domain: `.${rootDomain}` } : {}),
};

export async function getAccessToken(): Promise<string | undefined> {
  return (await cookies()).get(accessTokenCookie)?.value;
}

export function sessionCookieOptions(maxAge: number | undefined) {
  return { ...cookieOptions, maxAge: maxAge ?? 300 };
}

export const sessionCookies = { accessTokenCookie, refreshTokenCookie, cookieOptions };

export const returnToCookie = "umfrage_return_to";

export function returnToCookieOptions() {
  return { ...cookieOptions, maxAge: 600 };
}
