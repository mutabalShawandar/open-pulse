import { redirect } from "next/navigation";

import { ApiError, getCurrentUser } from "@/lib/api/client";
import type { CurrentUser } from "@/lib/api/types";
import { getAccessToken } from "@/lib/auth/session";

export async function requireUser(): Promise<CurrentUser> {
  const accessToken = await getAccessToken();
  if (!accessToken) redirect("/login");

  try {
    const user = await getCurrentUser(accessToken);
    if (!user.is_active) redirect("/access-denied");
    return user;
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) redirect("/access-denied");
    redirect("/login");
  }
}
