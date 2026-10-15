import Link from "next/link";
import { ArrowLeftIcon, Building2Icon, MapPinIcon, PencilIcon } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

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

async function loadSurveyVersionManagement(workspaceId: string, versionLabel: (survey: string, number: number | string) => string) {
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
          label: versionLabel(survey.title, version.version_number ?? "—"),
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
  const t = await getTranslations("workspaces");
  const tc = await getTranslations("campaigns");
  const workspace = await loadWorkspace(workspaceSlug);
  const address = fullAddress(workspace);
  const query = await searchParams;
  const surveyVersionManagement = await loadSurveyVersionManagement(workspace.id, (survey, number) => tc("versionLine", { survey, number }));
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
        {t("detail.all")}
      </Button>
      <section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div className="flex items-start gap-4">
          {workspace.logo_url ? (
            <img src={workspace.logo_url} alt={t("logoAlt", { name: workspace.name })} className="size-12 rounded-2xl bg-white object-contain p-1 shadow-lg shadow-primary/15" />
          ) : (
            <div className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/15">
              <Building2Icon className="size-6" />
            </div>
          )}
          <div>
            <p className="text-sm font-medium text-muted-foreground">{t("detail.profile")}</p>
            <h1 className="mt-1 font-heading text-3xl font-semibold tracking-tight">{workspace.name}</h1>
            <p className="mt-2 text-sm text-muted-foreground">/{workspace.slug}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary">{t("detail.badge")}</Badge>
          <Button nativeButton={false} variant="outline" render={<Link href={`/workspaces/${workspaceSlug}/edit`} />}>
            <PencilIcon data-icon="inline-start" />
            {t("detail.edit")}
          </Button>
          <Button nativeButton={false} variant="outline" render={<Link href={`/workspaces/${workspaceSlug}/campaigns`} />}>{t("detail.campaigns")}</Button>
          <Button nativeButton={false} variant="outline" render={<Link href={`/workspaces/${workspaceSlug}/recipients`} />}>{t("detail.recipients")}</Button>
          <Button nativeButton={false} variant="outline" render={<Link href={`/workspaces/${workspaceSlug}/analytics`} />}>{t("detail.analytics")}</Button>
        </div>
      </section>
      {query.created || query.updated ? (
        <Alert>
          <AlertTitle>{query.created ? t("detail.createdTitle") : t("detail.updatedTitle")}</AlertTitle>
          <AlertDescription>
            {query.created ? t("detail.createdBody") : t("detail.updatedBody")}
          </AlertDescription>
        </Alert>
      ) : null}
      {query.assignmentAdded || query.assignmentRemoved ? (
        <Alert>
          <AlertTitle>{query.assignmentAdded ? t("detail.assignmentAdded") : t("detail.assignmentRemoved")}</AlertTitle>
          <AlertDescription>
            {query.assignmentAdded ? t("detail.addedBody") : t("detail.removedBody")}
          </AlertDescription>
        </Alert>
      ) : null}
      {assignmentError ? (
        <Alert variant="destructive">
          <AlertTitle>{t("detail.assignErrorTitle")}</AlertTitle>
          <AlertDescription>
            {assignmentError === "exists" ? t("detail.exists") : assignmentError === "validation" ? t("detail.validation") : t("detail.unknown")}
          </AlertDescription>
        </Alert>
      ) : null}
      <Card>
        <CardHeader className="border-b">
          <CardTitle>{t("detail.locationTitle")}</CardTitle>
          <CardDescription>
            {t("detail.locationHint")}
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
            <p className="text-sm text-muted-foreground">{t("detail.noLocation")}</p>
          )}
        </CardContent>
      </Card>
      {surveyVersionManagement ? (
        <Card>
          <CardHeader className="border-b">
            <CardTitle>{t("detail.versionsTitle")}</CardTitle>
            <CardDescription>
              {t("detail.versionsHint")}
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
