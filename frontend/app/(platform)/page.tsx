import { PlatformWelcome } from "@/components/platform/platform-welcome";
import { ApiError, listClinics, listSurveys } from "@/lib/api/client";
import { getAccessToken } from "@/lib/auth/session";
import { requireUser } from "@/lib/auth/require-user";
import { redirect } from "next/navigation";

export default async function PlatformHomePage() {
  const user = await requireUser();
  const accessToken = await getAccessToken();
  let clinics = [];
  let surveys = [];
  if (accessToken) {
    try {
      [clinics, surveys] = await Promise.all([listClinics(accessToken), listSurveys(accessToken)]);
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) redirect("/access-denied");
      throw error;
    }
  }

  return <PlatformWelcome clinics={clinics} surveys={surveys} user={user} />;
}
