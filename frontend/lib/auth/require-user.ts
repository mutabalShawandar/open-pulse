import { redirect } from "next/navigation";

import { ApiError, getCurrentUser } from "@/lib/api/client";
import type { CurrentUser } from "@/lib/api/types";
import { getAccessToken } from "@/lib/auth/session";

export async function requireUser(): Promise<CurrentUser> {
  const accessToken = await getAccessToken();
  if (!accessToken) redirect("/login");

  // redirect() works by throwing, so it must stay outside the try/catch below.
  let user: CurrentUser;
  try {
    user = await getCurrentUser(accessToken);
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) redirect("/access-denied");
    redirect("/login");
  }
  if (!user.is_active) redirect("/access-denied");
  return user;
}
