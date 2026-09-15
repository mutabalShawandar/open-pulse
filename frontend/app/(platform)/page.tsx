import { PlatformWelcome } from "@/components/platform/platform-welcome";
import { listClinics, listSurveys } from "@/lib/api/client";
import { getAccessToken } from "@/lib/auth/session";
import { requireUser } from "@/lib/auth/require-user";

export default async function PlatformHomePage() {
  const user = await requireUser();
  const accessToken = await getAccessToken();
  const [clinics, surveys] = accessToken ? await Promise.all([listClinics(accessToken), listSurveys(accessToken)]) : [[], []];

  return <PlatformWelcome clinics={clinics} surveys={surveys} user={user} />;
}
