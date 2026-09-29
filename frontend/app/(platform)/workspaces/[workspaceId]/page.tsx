import Link from "next/link";
import { ArrowLeftIcon, Building2Icon, MapPinIcon, PencilIcon } from "lucide-react";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { WorkspaceSurveyVersions } from "@/components/workspaces/workspace-survey-versions";
import {
  ApiError,
  listWorkspaceSurveyVersionAssignments,
  listPublishedSurveyVersions,
  listSurveys,
} from "@/lib/api/client";
import { getAccessToken } from "@/lib/auth/session";
import { resolveWorkspaceBySlug } from "@/lib/resolve-workspace";

function fullAddress(workspace: {
  street: string | null;
  hausnummer: number | null;
  postal_code: string | null;
  city: string | null;
}) {
  const streetLine = [workspace.street, workspace.hausnummer].filter(Boolean).join(" ");
  const cityLine = [workspace.postal_code, workspace.city].filter(Boolean).join(" ");
  return [streetLine, cityLine].filter(Boolean);
}

async function loadWorkspace(workspaceSlug: string) {
  const accessToken = await getAccessToken();
  if (!accessToken) notFound();

  try {
    return await resolveWorkspaceBySlug(accessToken, workspaceSlug);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
}

async function loadSurveyVersionManagement(workspaceId: string) {
  const accessToken = await getAccessToken();
  if (!accessToken) return null;

  const assignments = await listWorkspaceSurveyVersionAssignments(accessToken, workspaceId);

  try {
    const surveys = await listSurveys(accessToken);
    const versions = await Promise.all(
      surveys.map(async (survey) => ({
        survey,
        versions: await listPublishedSurveyVersions(accessToken, survey.id),
      })),
    );
    const options = versions.flatMap(({ survey, versions: publishedVersions }) =>
      publishedVersions
        .filter((version) => version.status === "published")
        .map((version) => ({
          id: version.id,
          label: `${survey.title} · Version ${version.version_number ?? "—"}`,
        })),
    );
    return { assignments, options };
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) {
      return { assignments, options: null };
    }
    throw error;
  }
}

export default async function WorkspaceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<{
    created?: string;
    updated?: string;
    assignmentAdded?: string;
    assignmentRemoved?: string;
    assignmentError?: string;
  }>;
}) {
  const { workspaceId: workspaceSlug } = await params;
  const workspace = await loadWorkspace(workspaceSlug);
  const address = fullAddress(workspace);
  const query = await searchParams;
  const surveyVersionManagement = await loadSurveyVersionManagement(workspace.id);
  const assignmentError = query.assignmentError;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-7 sm:px-6 lg:px-10 lg:py-10">
      <Button
        nativeButton={false}
        variant="ghost"
        className="w-fit"
        render={<Link href="/workspaces" />}
      >
        <ArrowLeftIcon data-icon="inline-start" />
        Alle Kliniken
      </Button>
      <section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div className="flex items-start gap-4">
          {workspace.logo_url ? (
            <img src={workspace.logo_url} alt={`${workspace.name} Logo`} className="size-12 rounded-2xl bg-white object-contain p-1 shadow-lg shadow-primary/15" />
          ) : (
            <div className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/15">
              <Building2Icon className="size-6" />
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-muted-foreground">Klinikprofil</p>
            <h1 className="mt-1 font-heading text-3xl font-semibold tracking-tight">{workspace.name}</h1>
            <p className="mt-2 text-sm text-muted-foreground">/{workspace.slug}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary">Stammdaten</Badge>
          <Button nativeButton={false} variant="outline" render={<Link href={`/workspaces/${workspaceSlug}/edit`} />}>
            <PencilIcon data-icon="inline-start" />
            Bearbeiten
          </Button>
          <Button nativeButton={false} variant="outline" render={<Link href={`/workspaces/${workspaceSlug}/campaigns`} />}>Kampagnen</Button>
          <Button nativeButton={false} variant="outline" render={<Link href={`/workspaces/${workspaceSlug}/recipients`} />}>Empfänger</Button>
          <Button nativeButton={false} variant="outline" render={<Link href={`/workspaces/${workspaceSlug}/analytics`} />}>Auswertungen</Button>
        </div>
      </section>
      {query.created || query.updated ? (
        <Alert>
          <AlertTitle>{query.created ? "Klinik angelegt" : "Änderungen gespeichert"}</AlertTitle>
          <AlertDescription>
            {query.created
              ? "Die Klinik steht jetzt für die weitere Einrichtung bereit."
              : "Die Stammdaten der Klinik wurden aktualisiert."}
          </AlertDescription>
        </Alert>
      ) : null}
      {query.assignmentAdded || query.assignmentRemoved ? (
        <Alert>
          <AlertTitle>{query.assignmentAdded ? "Version zugeordnet" : "Zuordnung aufgehoben"}</AlertTitle>
          <AlertDescription>
            {query.assignmentAdded
              ? "Die veröffentlichte Version kann jetzt für diese Klinik verwendet werden."
              : "Die Version steht nicht mehr für neue Kampagnen dieser Klinik bereit."}
          </AlertDescription>
        </Alert>
      ) : null}
      {assignmentError ? (
        <Alert variant="destructive">
          <AlertTitle>Zuordnung nicht aktualisiert</AlertTitle>
          <AlertDescription>
            {assignmentError === "exists"
              ? "Diese veröffentlichte Version ist bereits der Klinik zugeordnet."
              : assignmentError === "validation"
                ? "Bitte wählen Sie eine veröffentlichte Version aus."
                : "Die Änderung konnte nicht gespeichert werden. Bitte versuchen Sie es erneut."}
          </AlertDescription>
        </Alert>
      ) : null}
      <Card>
        <CardHeader className="border-b">
          <CardTitle>Standortdaten</CardTitle>
          <CardDescription>
            Diese Angaben bilden die Grundlage für die spätere klinikspezifische Umfrageausspielung.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          {address.length > 0 ? (
            <div className="flex items-start gap-3">
              <MapPinIcon className="mt-0.5 size-4 text-primary" />
              <address className="not-italic text-sm leading-6">
                {address.map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
              </address>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Für diese Klinik sind noch keine Standortdaten hinterlegt.</p>
          )}
        </CardContent>
      </Card>
      {surveyVersionManagement ? (
        <Card>
          <CardHeader className="border-b">
            <CardTitle>Veröffentlichte Umfrageversionen</CardTitle>
            <CardDescription>
              Kampagnen wählen später ausschließlich aus diesen aktiven, unveränderlichen Versionen.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-5">
            <WorkspaceSurveyVersions workspaceSlug={workspaceSlug} {...surveyVersionManagement} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
