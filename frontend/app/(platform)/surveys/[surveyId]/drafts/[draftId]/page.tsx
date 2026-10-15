import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { DraftSectionEditor } from "@/components/surveys/draft-section-editor";
import { DraftPreview } from "@/components/surveys/draft-preview";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ApiError, getSurvey, getSurveyDraft } from "@/lib/api/client";
import { getAccessToken } from "@/lib/auth/session";

export default async function SurveyDraftPage({
  params,
  searchParams,
}: PageProps<"/surveys/[surveyId]/drafts/[draftId]">) {
  const { surveyId, draftId } = await params;
  const query = await searchParams;
  const accessToken = await getAccessToken();
  if (!accessToken) notFound();
  const t = await getTranslations("surveys.draftPage");

  const [survey, draft] = await Promise.all([
    getSurvey(accessToken, surveyId),
    getSurveyDraft(accessToken, surveyId, draftId),
  ]).catch((error: unknown) => {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  });

  const errorMessage = typeof query.error === "string"
    ? (typeof query.message === "string" ? query.message : t("actionFailed"))
    : null;

  return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-7 sm:px-6 lg:px-10 lg:py-10">
        <Button nativeButton={false} variant="ghost" className="w-fit" render={<Link href={`/surveys/${surveyId}`} />}>
          <ArrowLeftIcon data-icon="inline-start" />{t("toSurvey")}
        </Button>
        <header className="border-l-4 border-primary pl-5">
          <p className="text-sm font-medium text-primary">{t("edit")}</p>
          <h1 className="mt-1 font-heading text-3xl font-semibold tracking-tight">{draft.draft_label || survey.title}</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">{t("intro")}</p>
        </header>
        {errorMessage ? (
          <Alert variant="destructive">
            <AlertTitle>{t("errorTitle")}</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}
        <DraftPreview surveyId={surveyId} draftId={draftId} title={draft.draft_label || survey.title} sections={draft.sections} />
        <DraftSectionEditor surveyId={surveyId} draftId={draftId} sections={draft.sections} />
    </div>
  );
}
