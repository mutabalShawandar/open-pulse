import { getTranslations } from "next-intl/server";

import { Spinner } from "@/components/ui/spinner";

export default async function PublicSurveyLoading() {
  const t = await getTranslations("publicSurvey");
  return (
    <main className="flex min-h-screen items-center justify-center bg-background" aria-live="polite" aria-label={t("loading")}>
      <Spinner className="size-6 text-primary" />
    </main>
  );
}
