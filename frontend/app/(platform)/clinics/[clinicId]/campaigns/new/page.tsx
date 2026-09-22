import Link from "next/link";
import { notFound } from "next/navigation";

import { CampaignWizard } from "@/components/campaigns/campaign-wizard";
import { Button } from "@/components/ui/button";
import { ApiError, getClinic, listClinicSurveyVersionAssignments, listPublishedSurveyVersions, listRecipients, listSurveys } from "@/lib/api/client";
import { getAccessToken } from "@/lib/auth/session";

async function loadSurveyVersionOptions(token: string, clinicId: string) {
  const assignments = (await listClinicSurveyVersionAssignments(token, clinicId)).filter((assignment) => assignment.unassigned_at === null);
  if (assignments.length === 0) return [];
  const assignedIds = new Set(assignments.map((assignment) => assignment.survey_version_id));
  const surveys = await listSurveys(token);
  const versions = await Promise.all(surveys.map(async (survey) => ({ survey, versions: await listPublishedSurveyVersions(token, survey.id) })));
  return versions.flatMap(({ survey, versions: publishedVersions }) =>
    publishedVersions
      .filter((version) => version.status === "published" && assignedIds.has(version.id))
      .map((version) => ({ id: version.id, label: `${survey.title} · Version ${version.version_number ?? "—"}` })),
  );
}

export default async function NewCampaignPage(props: PageProps<"/clinics/[clinicId]/campaigns/new">) {
  const { clinicId } = await props.params;
  const token = await getAccessToken();
  if (!token) return null;
  let clinic;
  try {
    clinic = await getClinic(token, clinicId);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
  const [recipients, surveyVersionOptions] = await Promise.all([
    listRecipients(token, clinicId),
    loadSurveyVersionOptions(token, clinicId),
  ]);
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-7 sm:px-6 lg:py-10">
      <Button nativeButton={false} variant="ghost" className="w-fit" render={<Link href={`/clinics/${clinicId}/campaigns`} />}>← Kampagnen</Button>
      <div><p className="text-sm text-muted-foreground">{clinic.name}</p><h1 className="mt-2 text-3xl font-semibold">Kampagne erstellen</h1></div>
      <CampaignWizard clinicId={clinicId} initialRecipients={recipients.filter((recipient) => recipient.status === "active")} surveyVersionOptions={surveyVersionOptions} />
    </div>
  );
}
