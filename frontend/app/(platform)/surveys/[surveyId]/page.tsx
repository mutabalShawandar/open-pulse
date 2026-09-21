import Link from "next/link";
import { ArrowLeftIcon, ArchiveIcon, RotateCcwIcon } from "lucide-react";
import { notFound } from "next/navigation";

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

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-7 sm:px-6 lg:px-10 lg:py-10">
      <Button nativeButton={false} variant="ghost" className="w-fit" render={<Link href="/surveys" />}>
        <ArrowLeftIcon data-icon="inline-start" />Alle Umfragen
      </Button>

      <section className="flex flex-col justify-between gap-4 border-l-4 border-primary pl-5 sm:flex-row sm:items-end">
        <div>
          <Badge variant={survey.status === "published" ? "default" : "secondary"}>
            {archived ? "Archiviert" : survey.status === "published" ? "Veröffentlicht" : "Entwurf"}
          </Badge>
          <h1 className="mt-3 font-heading text-3xl font-semibold tracking-tight">{survey.title}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <SurveyCopyDialog
            action={copySurveyAction.bind(null, survey.id)}
            description={survey.description}
            sourceVersions={[
              ...survey.drafts.map((draft) => ({
                id: draft.id,
                label: `${draft.draft_label || "Unbenannter Entwurf"} · bearbeitbarer Entwurf`,
              })),
              ...versions.map((version) => ({
                id: version.id,
                label: `Version ${version.version_number} · veröffentlicht`,
              })),
            ]}
            surveyTitle={survey.title}
          />
          <form action={(archived ? restoreSurveyAction : archiveSurveyAction).bind(null, survey.id)}>
            <Button type="submit" variant={archived ? "outline" : "destructive"}>
              {archived ? <RotateCcwIcon data-icon="inline-start" /> : <ArchiveIcon data-icon="inline-start" />}
              {archived ? "Wiederherstellen" : "Archivieren"}
            </Button>
          </form>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <Card>
          <CardHeader>
            <CardTitle>Stammdaten</CardTitle>
            <CardDescription>Änderungen betreffen nicht bereits veröffentlichte Versionen.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={updateSurveyAction.bind(null, survey.id)}>
              <FieldGroup>
                <Field><FieldLabel htmlFor="title">Titel</FieldLabel><Input id="title" name="title" defaultValue={survey.title} disabled={archived} required /></Field>
                <Field><FieldLabel htmlFor="description">Beschreibung</FieldLabel><Textarea id="description" name="description" defaultValue={survey.description ?? ""} disabled={archived} /></Field>
                {!archived ? <Button type="submit" className="w-fit">Speichern</Button> : null}
              </FieldGroup>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Versionen</CardTitle>
            <CardDescription>{survey.drafts.length} Entwürfe · {versions.length} veröffentlicht</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {!archived ? (
              <SurveyNewDraftDialog
                action={createSurveyDraftAction.bind(null, survey.id)}
                sourceVersions={[
                  ...survey.drafts.map((draft) => ({
                    id: draft.id,
                    label: `${draft.draft_label || "Unbenannter Entwurf"} · bearbeitbarer Entwurf`,
                  })),
                  ...versions.map((version) => ({
                    id: version.id,
                    label: `Version ${version.version_number} · veröffentlicht`,
                  })),
                ]}
              />
            ) : null}
            {survey.drafts.map((draft) => (
              <div key={draft.id} className="rounded-lg border p-3">
                <p className="font-medium">{draft.draft_label || "Unbenannter Entwurf"}</p>
                <p className="mt-1 text-sm text-muted-foreground">Bearbeitbar</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button nativeButton={false} variant="outline" size="sm" render={<Link href={`/surveys/${survey.id}/drafts/${draft.id}`} />}>
                    Entwurf bearbeiten
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
                <p className="font-medium">Version {version.version_number}</p>
                <p className="mt-1 text-sm text-muted-foreground">Unveränderlich veröffentlicht</p>
                <Button nativeButton={false} variant="outline" size="sm" className="mt-3" render={<Link href={`/surveys/${survey.id}/versions/${version.version_number}`} />}>
                  Version ansehen
                </Button>
              </div>
            ))}
            {!survey.drafts.length && !versions.length ? <p className="text-sm text-muted-foreground">Noch keine Versionen.</p> : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
