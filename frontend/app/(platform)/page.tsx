import { PlatformWelcome } from "@/components/platform/platform-welcome";
import { ApiError, listWorkspaces, listSurveys } from "@/lib/api/client";
import { getAccessToken } from "@/lib/auth/session";
import { requireUser } from "@/lib/auth/require-user";
import type { Workspace, Survey } from "@/lib/api/types";
import { redirect } from "next/navigation";

export default async function PlatformHomePage() {
  const user = await requireUser();
  const accessToken = await getAccessToken();
  let workspaces: Workspace[] = [];
  let surveys: Survey[] = [];
  if (accessToken) {
    try {
      [workspaces, surveys] = await Promise.all([listWorkspaces(accessToken), listSurveys(accessToken)]);
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) redirect("/access-denied");
      throw error;
    }
  }

  return <PlatformWelcome workspaces={workspaces} surveys={surveys} user={user} />;
}
