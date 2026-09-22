import Link from "next/link";
import { ExternalLinkIcon } from "lucide-react";

import { SendCampaignDialog } from "@/components/campaigns/send-campaign-dialog";
import { DeleteCampaignDialog } from "@/components/campaigns/delete-campaign-dialog";
import { ChangeSurveyVersionDialog } from "@/components/campaigns/change-survey-version-dialog";
import { EmailTemplateEditor } from "@/components/campaigns/email-template-editor";
import { RecipientImportForm } from "@/components/campaigns/recipient-import-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AnalyticsExportActions } from "@/components/clinics/analytics-export-actions";
import { AnalyticsQuestionCard } from "@/components/clinics/analytics-question-card";
import {
  changeCampaignStatusAction,
  changeCampaignSurveyVersionAction,
  deleteCampaignAction,
  importCampaignRecipientsAction,
  assignCampaignRecipientsAction,
  removeCampaignRecipientAction,
  saveCampaignEmailTemplateAction,
  testCampaignEmailTemplateAction,
  queueCampaignDeliveriesAction,
  retryFailedCampaignDeliveriesAction,
} from "../actions";
import {
  ApiError,
  getCampaign,
  getCampaignAnalytics,
  getCampaignEmailTemplate,
  listCampaignDeliveries,
  listCampaignRecipients,
  listClinicSurveyVersionAssignments,
  listPublishedSurveyVersions,
  listRecipients,
  listSurveys,
} from "@/lib/api/client";
import { getAccessToken } from "@/lib/auth/session";
import { campaignStatusLabels } from "@/lib/campaign-status";
import { buildPublicSurveyUrl } from "@/lib/public-link";
import { resolveClinicBySlug } from "@/lib/resolve-clinic";
import type { Campaign, CampaignAnalytics } from "@/lib/api/types";

const statusMessages: Record<string, string> = {
  "400": "Ungültige Eingabe.",
  "401": "Ihre Sitzung ist abgelaufen. Bitte erneut anmelden.",
  "403": "Sie haben keine Berechtigung für diese Änderung.",
  "404": "Kampagne oder Vorlage wurde nicht gefunden.",
  "409": "Die Kampagne wurde bereits aktiviert oder die Vorlage ist gesperrt und kann nicht mehr geändert werden.",
  "422": "Bitte prüfen Sie die Eingaben.",
};

function emailErrorMessage(error: string | undefined, statusCode: string | undefined) {
  if (error !== "template" && error !== "test") return null;
  const detail = (statusCode && statusMessages[statusCode]) ?? "Bitte versuchen Sie es erneut.";
  if (error === "test") return `Test-E-Mail konnte nicht gesendet werden. ${detail}`;
  return `Vorlage konnte nicht gespeichert werden. ${detail}`;
}

function statusErrorMessage(error: string | undefined, statusCode: string | undefined) {
  if (error !== "status") return null;
  if (statusCode === "409") return "Statusänderung nicht möglich: Nach dem Versand kann die Kampagne nicht mehr zu „Entwurf“ oder „Geplant“ zurückgesetzt werden.";
  return `Status konnte nicht geändert werden. ${(statusCode && statusMessages[statusCode]) ?? "Bitte versuchen Sie es erneut."}`;
}

function sendErrorMessage(error: string | undefined, statusCode: string | undefined) {
  if (error !== "send") return null;
  if (statusCode === "409") return "Versand konnte nicht in die Warteschlange gestellt werden. Häufige Ursachen: Es ist noch kein SMTP-Server unter „E-Mail-Versand“ in der Administration konfiguriert, es wurde noch keine E-Mail-Vorlage gespeichert, oder die Kampagne befindet sich nicht mehr im Status „draft“/„scheduled“.";
  return `Versand konnte nicht in die Warteschlange gestellt werden. ${(statusCode && statusMessages[statusCode]) ?? "Bitte versuchen Sie es erneut."}`;
}

async function loadAssignedSurveyVersionOptions(token: string, clinicId: string) {
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

export default async function CampaignDetailPage(props: PageProps<"/clinics/[clinicId]/campaigns/[campaignId]">) {
  const { clinicId, campaignId } = await props.params;
  const query = await props.searchParams;
  const token = await getAccessToken();
  if (!token) return null;

  const clinic = await resolveClinicBySlug(token, clinicId);

  const [campaign, template, assignedRecipients, clinicRecipients, deliveries, surveyVersionOptions] = await Promise.all([
    getCampaign(token, campaignId),
    getCampaignEmailTemplate(token, campaignId),
    listCampaignRecipients(token, campaignId),
    listRecipients(token, clinic.id),
    listCampaignDeliveries(token, campaignId),
    loadAssignedSurveyVersionOptions(token, clinic.id),
  ]);

  let analytics: CampaignAnalytics | null = null;
  try {
    analytics = await getCampaignAnalytics(token, clinic.id, campaignId);
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 403)) throw error;
  }

  const link = buildPublicSurveyUrl(clinic.slug, campaign.public_slug);
  const totals = { queued: deliveries.filter((delivery) => delivery.status === "queued" || delivery.status === "sending").length, sent: deliveries.filter((delivery) => delivery.status === "sent").length, failed: deliveries.filter((delivery) => delivery.status === "failed").length };
  const hasDeliveries = deliveries.length > 0;
  const editable = (campaign.status === "draft" || campaign.status === "scheduled") && !hasDeliveries;
  const hasResponses = (analytics?.started_count ?? 0) > 0;
  const assignedIds = new Set(assignedRecipients.map((item) => item.recipient_id));
  const availableRecipients = clinicRecipients.filter((item) => item.status === "active" && !assignedIds.has(item.id));
  const hasFailedDeliveries = deliveries.some((delivery) => delivery.status === "failed");
  const imported = typeof query.created === "string";
  const emailMessage = emailErrorMessage(typeof query.error === "string" ? query.error : undefined, typeof query.status === "string" ? query.status : undefined);
  const sendMessage = sendErrorMessage(typeof query.error === "string" ? query.error : undefined, typeof query.status === "string" ? query.status : undefined);
  const statusMessage = statusErrorMessage(typeof query.error === "string" ? query.error : undefined, typeof query.status === "string" ? query.status : undefined);
  const sentCount = typeof query.sent === "string" ? Number(query.sent) : null;
  const activeTab = typeof query.tab === "string" ? query.tab : "overview";
  const date = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" });
  const statusOptions = (Object.entries(campaignStatusLabels) as [Campaign["status"], string][]).filter(([value]) => hasDeliveries ? value !== "draft" && value !== "scheduled" : true);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-7 sm:px-6 lg:py-10">
      <Button nativeButton={false} variant="ghost" className="w-fit" render={<Link href={`/clinics/${clinicId}/campaigns`} />}>← Kampagnen</Button>
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Kampagne · {campaignStatusLabels[campaign.status]}</p>
          <h1 className="mt-2 text-3xl font-semibold">{campaign.title}</h1>
          <p className="mt-2 text-muted-foreground">{campaign.survey_title} · Version {campaign.survey_version_number}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ChangeSurveyVersionDialog campaignId={campaign.id} currentSurveyVersionId={campaign.survey_version_id} currentLabel={`${campaign.survey_title} · Version ${campaign.survey_version_number}`} options={surveyVersionOptions} changeAction={changeCampaignSurveyVersionAction.bind(null, clinicId)} disabled={!editable || hasResponses} />
          <DeleteCampaignDialog campaignId={campaign.id} campaignTitle={campaign.title} deleteAction={deleteCampaignAction.bind(null, clinicId)} disabled={hasResponses} />
        </div>
      </section>

      <Tabs defaultValue={activeTab}>
        <TabsList>
          <TabsTrigger value="overview">Übersicht</TabsTrigger>
          <TabsTrigger value="recipients">Empfänger ({assignedRecipients.length})</TabsTrigger>
          <TabsTrigger value="email">E-Mail-Vorlage</TabsTrigger>
          <TabsTrigger value="deliveries">Zustellungen</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="flex flex-col gap-6 pt-4">
          {sendMessage ? <Alert variant="destructive"><AlertTitle>Versand fehlgeschlagen</AlertTitle><AlertDescription>{sendMessage}</AlertDescription></Alert> : null}
          {statusMessage ? <Alert variant="destructive"><AlertTitle>Status nicht geändert</AlertTitle><AlertDescription>{statusMessage}</AlertDescription></Alert> : null}
          {sentCount !== null ? <Alert><AlertTitle>Versand erfolgreich gestartet</AlertTitle><AlertDescription>{sentCount > 0 ? `${sentCount} E-Mail(s) wurden in die Versandwarteschlange gestellt.` : "Es wurden keine neuen E-Mails in die Warteschlange gestellt — alle ausgewählten Empfänger waren bereits versendet."} Der Status wurde auf „Versendet“ gesetzt.</AlertDescription></Alert> : null}
          {hasResponses ? <Alert><AlertTitle>Kampagne läuft bereits</AlertTitle><AlertDescription>Es liegen bereits Antworten vor. Umfrageversion und Löschen sind deshalb gesperrt.</AlertDescription></Alert> : null}
          <div className="flex flex-wrap gap-2"><SendCampaignDialog campaignTitle={campaign.title} recipientCount={assignedRecipients.length} subject={template?.subject ?? ""} action={queueCampaignDeliveriesAction.bind(null, clinicId, campaign.id)} /></div>
          <Card><CardHeader><CardTitle>Versandübersicht</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-3"><p><span className="block text-2xl font-semibold">{totals.queued}</span><span className="text-sm text-muted-foreground">in Warteschlange</span></p><p><span className="block text-2xl font-semibold">{totals.sent}</span><span className="text-sm text-muted-foreground">versendet</span></p><p><span className="block text-2xl font-semibold">{totals.failed}</span><span className="text-sm text-muted-foreground">fehlgeschlagen</span></p></CardContent></Card>
          <Card><CardHeader><CardTitle>Öffentlicher Umfragelink</CardTitle></CardHeader><CardContent className="flex flex-wrap items-center gap-3"><code className="rounded bg-muted px-3 py-2 text-sm">{link}</code><Button nativeButton={false} variant="outline" render={<a href={link} target="_blank" rel="noreferrer" />}><ExternalLinkIcon data-icon="inline-start" />Öffnen</Button></CardContent></Card>
          <Card><CardHeader><CardTitle>Status</CardTitle><CardDescription>{hasDeliveries ? "Es wurden bereits E-Mails versendet — die Kampagne kann nicht mehr zu „Entwurf“ oder „Geplant“ zurückgesetzt werden." : "Empfänger und Vorlage können nur im Status „Entwurf“ oder „Geplant“ bearbeitet werden. Der Versand setzt den Status automatisch auf „Versendet“."}</CardDescription></CardHeader><CardContent className="flex flex-wrap gap-2">{statusOptions.map(([value, label]) => <form key={value} action={changeCampaignStatusAction.bind(null, clinicId, campaign.id)}><input type="hidden" name="status" value={value} /><Button type="submit" variant={campaign.status === value ? "default" : "outline"}>{label}</Button></form>)}</CardContent></Card>
        </TabsContent>

        <TabsContent value="recipients" className="flex flex-col gap-6 pt-4">
          {imported ? <Alert><AlertTitle>Import abgeschlossen</AlertTitle><AlertDescription>{query.created} neu, {query.duplicates ?? 0} bereits vorhanden, {query.assigned ?? 0} dieser Kampagne hinzugefügt.</AlertDescription></Alert> : null}
          {query.error === "recipients" || query.error === "file-size" ? <Alert variant="destructive"><AlertTitle>Import fehlgeschlagen</AlertTitle><AlertDescription>Prüfen Sie Format, E-Mail-Adressen und die maximale Anzahl von 2.000 Empfängern.</AlertDescription></Alert> : null}
          <Card>
            <CardHeader><CardTitle>Empfänger importieren</CardTitle></CardHeader>
            <CardContent>{editable ? <RecipientImportForm action={importCampaignRecipientsAction.bind(null, clinicId, campaign.id)} /> : <p className="text-sm text-muted-foreground">Die Kampagne ist nicht mehr bearbeitbar.</p>}</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Zur Kampagne hinzufügen</CardTitle></CardHeader>
            <CardContent>
              {editable && availableRecipients.length ? (
                <form action={assignCampaignRecipientsAction.bind(null, clinicId, campaign.id)} className="flex flex-col gap-3">
                  <div className="max-h-80 overflow-y-auto rounded-md border">{availableRecipients.map((item) => <label key={item.id} className="flex items-center gap-3 border-b px-3 py-2 last:border-0"><input name="recipientId" type="checkbox" value={item.id} /><span>{item.display_name || item.email}{item.display_name ? <span className="text-muted-foreground"> · {item.email}</span> : null}</span></label>)}</div>
                  <Button className="w-fit" type="submit">Auswahl hinzufügen</Button>
                </form>
              ) : <p className="text-sm text-muted-foreground">Keine weiteren aktiven Empfänger verfügbar.</p>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Ausgewählt ({assignedRecipients.length})</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-2">
              {assignedRecipients.length ? assignedRecipients.map((item) => <div key={item.id} className="flex items-center gap-3 rounded-md border px-3 py-2"><span className="min-w-0 flex-1 truncate">{item.display_name || item.email}{item.display_name ? <span className="text-muted-foreground"> · {item.email}</span> : null}</span><span className="text-xs text-muted-foreground">{item.status}</span>{editable ? <form action={removeCampaignRecipientAction.bind(null, clinicId, campaign.id, item.recipient_id)}><Button type="submit" size="sm" variant="ghost">Entfernen</Button></form> : null}</div>) : <p className="text-sm text-muted-foreground">Noch keine Empfänger ausgewählt.</p>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="email" className="flex flex-col gap-6 pt-4">
          {emailMessage ? <Alert variant="destructive"><AlertTitle>Fehler</AlertTitle><AlertDescription>{emailMessage}</AlertDescription></Alert> : null}
          {query.test === "sent" ? <Alert><AlertTitle>Test-E-Mail gesendet</AlertTitle><AlertDescription>Bitte prüfen Sie den Posteingang des Testempfängers.</AlertDescription></Alert> : null}
          {editable ? (
            <EmailTemplateEditor campaignTitle={campaign.title} template={template} saveAction={saveCampaignEmailTemplateAction.bind(null, clinicId, campaign.id)} testAction={testCampaignEmailTemplateAction.bind(null, clinicId, campaign.id)} />
          ) : <p className="text-sm text-muted-foreground">Die Kampagne ist nicht mehr bearbeitbar.</p>}
        </TabsContent>

        <TabsContent value="deliveries" className="flex flex-col gap-6 pt-4">
          {hasFailedDeliveries ? <form action={retryFailedCampaignDeliveriesAction.bind(null, clinicId, campaign.id)}><Button type="submit" variant="outline">Fehlgeschlagene Zustellungen erneut prüfen</Button></form> : null}
          <Card><CardHeader><CardTitle>{deliveries.length} Zustellungen</CardTitle></CardHeader><CardContent className="overflow-x-auto"><table className="w-full min-w-160 text-left text-sm"><thead className="border-b text-muted-foreground"><tr><th className="p-3">Empfänger</th><th className="p-3">Status</th><th className="p-3">Versuche</th><th className="p-3">Zeitpunkt</th><th className="p-3">Hinweis</th></tr></thead><tbody>{deliveries.map((delivery) => <tr key={delivery.id} className="border-b last:border-0"><td className="p-3"><span className="block font-medium">{delivery.display_name ?? "Ohne Namen"}</span><span className="text-muted-foreground">{delivery.email}</span></td><td className="p-3">{delivery.status}</td><td className="p-3">{delivery.attempt_count}</td><td className="p-3">{delivery.sent_at ? date.format(new Date(delivery.sent_at)) : delivery.queued_at ? date.format(new Date(delivery.queued_at)) : "–"}</td><td className="p-3 text-muted-foreground">{delivery.last_error ?? "–"}</td></tr>)}</tbody></table></CardContent></Card>
        </TabsContent>

        <TabsContent value="analytics" className="flex flex-col gap-6 pt-4">
          {analytics ? (
            <>
              <AnalyticsExportActions clinicId={clinic.id} campaignId={campaign.id} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Card><CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Gestartet</CardTitle><p className="mt-1 text-3xl font-semibold">{analytics.started_count}</p></CardHeader></Card>
                <Card><CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">Abgeschlossen</CardTitle><p className="mt-1 text-3xl font-semibold">{analytics.completed_count}</p></CardHeader></Card>
              </div>
              <section className="grid gap-4">{analytics.questions.map((question) => <AnalyticsQuestionCard key={question.question_id} question={question} />)}</section>
            </>
          ) : (
            <Badge variant="secondary">Keine Berechtigung für Auswertungen dieser Klinik.</Badge>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
