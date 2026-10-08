import Link from "next/link";
import { ArrowLeftIcon, ArchiveIcon, RotateCcwIcon } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import {
  archiveSurveyAction,
  copySurveyAction,
  createSurveyDraftAction,
  restoreSurveyAction,
  updateSurveyAction,
} from "@/app/(platform)/surveys/actions";
import { SurveyCopyDialog } from "@/components/surveys/survey-copy-dialog";
import { SurveyNewDraftDialog } from "@/components/surveys/survey-new-draft-dialog";
import { DraftPreview } from "@/components/surveys/draft-preview";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, getSurvey, getSurveyDraft, listPublishedSurveyVersions } from "@/lib/api/client";
import { getAccessToken } from "@/lib/auth/session";

export default async function SurveyDetailPage({
  params,
}: PageProps<"/surveys/[surveyId]">) {
  const { surveyId } = await params;
  const accessToken = await getAccessToken();
  if (!accessToken) notFound();
  const t = await getTranslations("surveys");

  let survey;
  try {
    survey = await getSurvey(accessToken, surveyId);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }

  const versions = await listPublishedSurveyVersions(accessToken, surveyId);
  const draftDetails = await Promise.all(
    survey.drafts.map((draft) => getSurveyDraft(accessToken, surveyId, draft.id)),
  );
  const draftsById = new Map(draftDetails.map((draft) => [draft.id, draft]));
  const archived = survey.status === "archived";
  const sourceVersions = [
    ...survey.drafts.map((draft) => ({
      id: draft.id,
      label: `${draft.draft_label || t("detail.unnamedDraft")} · ${t("detail.editableDraft")}`,
    })),
    ...versions.map((version) => ({
      id: version.id,
      label: t("detail.versionPublished", { number: version.version_number ?? "" }),
    })),
  ];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-7 sm:px-6 lg:px-10 lg:py-10">
      <Button nativeButton={false} variant="ghost" className="w-fit" render={<Link href="/surveys" />}>
        <ArrowLeftIcon data-icon="inline-start" />{t("detail.all")}
      </Button>

      <section className="flex flex-col justify-between gap-4 border-l-4 border-primary pl-5 sm:flex-row sm:items-end">
        <div>
          <Badge variant={survey.status === "published" ? "default" : "secondary"}>
            {archived ? t("status.archived") : survey.status === "published" ? t("status.published") : t("status.draft")}
          </Badge>
          <h1 className="mt-3 font-heading text-3xl font-semibold tracking-tight">{survey.title}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <SurveyCopyDialog
            action={copySurveyAction.bind(null, survey.id)}
            description={survey.description}
            sourceVersions={sourceVersions}
            surveyTitle={survey.title}
          />
          <form action={(archived ? restoreSurveyAction : archiveSurveyAction).bind(null, survey.id)}>
            <Button type="submit" variant={archived ? "outline" : "destructive"}>
              {archived ? <RotateCcwIcon data-icon="inline-start" /> : <ArchiveIcon data-icon="inline-start" />}
              {archived ? t("detail.restore") : t("detail.archive")}
            </Button>
          </form>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <Card>
          <CardHeader>
            <CardTitle>{t("detail.masterData")}</CardTitle>
            <CardDescription>{t("detail.masterDataHint")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={updateSurveyAction.bind(null, survey.id)}>
              <FieldGroup>
                <Field><FieldLabel htmlFor="title">{t("detail.fTitle")}</FieldLabel><Input id="title" name="title" defaultValue={survey.title} disabled={archived} required /></Field>
                <Field><FieldLabel htmlFor="description">{t("detail.fDescription")}</FieldLabel><Textarea id="description" name="description" defaultValue={survey.description ?? ""} disabled={archived} /></Field>
                {!archived ? <Button type="submit" className="w-fit">{t("detail.save")}</Button> : null}
              </FieldGroup>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t("detail.versions")}</CardTitle>
            <CardDescription>{t("detail.versionsCount", { drafts: survey.drafts.length, published: versions.length })}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {!archived ? (
              <SurveyNewDraftDialog
                action={createSurveyDraftAction.bind(null, survey.id)}
                sourceVersions={sourceVersions}
              />
            ) : null}
            {survey.drafts.map((draft) => (
              <div key={draft.id} className="rounded-lg border p-3">
                <p className="font-medium">{draft.draft_label || t("detail.unnamedDraft")}</p>
                <p className="mt-1 text-sm text-muted-foreground">{t("detail.editable")}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button nativeButton={false} variant="outline" size="sm" render={<Link href={`/surveys/${survey.id}/drafts/${draft.id}`} />}>
                    {t("detail.editDraft")}
                  </Button>
                  {draftsById.get(draft.id) ? (
                    <DraftPreview
                      surveyId={survey.id}
                      draftId={draft.id}
                      title={draft.draft_label || survey.title}
                      sections={draftsById.get(draft.id)!.sections}
                    />
                  ) : null}
                </div>
              </div>
            ))}
            {versions.map((version) => (
              <div key={version.id} className="rounded-lg border p-3">
                <p className="font-medium">{t("detail.version", { number: version.version_number ?? "" })}</p>
                <p className="mt-1 text-sm text-muted-foreground">{t("detail.immutable")}</p>
                <Button nativeButton={false} variant="outline" size="sm" className="mt-3" render={<Link href={`/surveys/${survey.id}/versions/${version.version_number}`} />}>
                  {t("detail.viewVersion")}
                </Button>
              </div>
            ))}
            {!survey.drafts.length && !versions.length ? <p className="text-sm text-muted-foreground">{t("detail.noVersions")}</p> : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
