import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { notFound } from "next/navigation";

import { DraftSectionEditor } from "@/components/surveys/draft-section-editor";
import { DraftPreview } from "@/components/surveys/draft-preview";
import { Button } from "@/components/ui/button";
import { ApiError, getSurvey, getSurveyDraft } from "@/lib/api/client";
import { getAccessToken } from "@/lib/auth/session";

export default async function SurveyDraftPage({
  params,
}: PageProps<"/surveys/[surveyId]/drafts/[draftId]">) {
  const { surveyId, draftId } = await params;
  const accessToken = await getAccessToken();
  if (!accessToken) notFound();

  const [survey, draft] = await Promise.all([
    getSurvey(accessToken, surveyId),
    getSurveyDraft(accessToken, surveyId, draftId),
  ]).catch((error: unknown) => {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  });

  return (
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-7 sm:px-6 lg:px-10 lg:py-10">
        <Button nativeButton={false} variant="ghost" className="w-fit" render={<Link href={`/surveys/${surveyId}`} />}>
          <ArrowLeftIcon data-icon="inline-start" />Zur Umfrage
        </Button>
        <header className="border-l-4 border-primary pl-5">
          <p className="text-sm font-medium text-primary">Entwurf bearbeiten</p>
          <h1 className="mt-1 font-heading text-3xl font-semibold tracking-tight">{draft.draft_label || survey.title}</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">Baue die Struktur deiner Umfrage auf. Veröffentlicht wird später immer eine unveränderliche Version.</p>
        </header>
        <DraftPreview surveyId={surveyId} draftId={draftId} title={draft.draft_label || survey.title} sections={draft.sections} />
        <DraftSectionEditor surveyId={surveyId} draftId={draftId} sections={draft.sections} />
    </div>
  );
}
