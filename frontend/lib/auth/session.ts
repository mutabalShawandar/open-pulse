import { cookies } from "next/headers";

const accessTokenCookie = "umfrage_access_token";
const refreshTokenCookie = "umfrage_refresh_token";
const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

export async function getAccessToken(): Promise<string | undefined> {
  return (await cookies()).get(accessTokenCookie)?.value;
}

export function sessionCookieOptions(maxAge: number | undefined) {
  return { ...cookieOptions, maxAge: maxAge ?? 300 };
}

export const sessionCookies = { accessTokenCookie, refreshTokenCookie, cookieOptions };
