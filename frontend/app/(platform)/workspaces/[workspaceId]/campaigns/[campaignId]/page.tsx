import Link from "next/link";
import { ExternalLinkIcon } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";

import { SendCampaignDialog } from "@/components/campaigns/send-campaign-dialog";
import { DeleteCampaignDialog } from "@/components/campaigns/delete-campaign-dialog";
import { ChangeSurveyVersionDialog } from "@/components/campaigns/change-survey-version-dialog";
import { CampaignEndDateForm } from "@/components/campaigns/campaign-end-date-form";
import { EmailTemplateEditor } from "@/components/campaigns/email-template-editor";
import { RecipientImportForm } from "@/components/campaigns/recipient-import-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AnalyticsExportActions } from "@/components/workspaces/analytics-export-actions";
import { AnalyticsQuestionCard } from "@/components/workspaces/analytics-question-card";
import {
  changeCampaignStatusAction,
  updateCampaignEndDateAction,
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
  listWorkspaceSurveyVersionAssignments,
  listPublishedSurveyVersions,
  listRecipients,
  listSurveys,
} from "@/lib/api/client";
import { getAccessToken } from "@/lib/auth/session";
import { campaignStatuses } from "@/lib/campaign-status";
import { buildPublicSurveyUrl } from "@/lib/public-link";
import { resolveWorkspaceBySlug } from "@/lib/resolve-workspace";
import type { CampaignAnalytics } from "@/lib/api/types";

type Translator = Awaited<ReturnType<typeof getTranslations<"campaigns">>>;

const httpStatusCodes = ["400", "401", "403", "404", "409", "422"];

function httpDetail(t: Translator, statusCode: string | undefined) {
  return statusCode && httpStatusCodes.includes(statusCode) ? t(`detail.http.${statusCode}` as never) : t("detail.http.fallback");
}

function emailErrorMessage(t: Translator, error: string | undefined, statusCode: string | undefined) {
  if (error !== "template" && error !== "test") return null;
  const detail = httpDetail(t, statusCode);
  return error === "test" ? t("detail.emailTest", { detail }) : t("detail.emailTemplate", { detail });
}

function statusErrorMessage(t: Translator, error: string | undefined, statusCode: string | undefined) {
  if (error !== "status") return null;
  if (statusCode === "409") return t("detail.status409");
  return t("detail.statusFailed", { detail: httpDetail(t, statusCode) });
}

function sendErrorMessage(t: Translator, error: string | undefined, statusCode: string | undefined) {
  if (error !== "send") return null;
  if (statusCode === "409") return t("detail.send409");
  return t("detail.sendFailed", { detail: httpDetail(t, statusCode) });
}

async function loadAssignedSurveyVersionOptions(token: string, workspaceId: string, versionLabel: (survey: string, number: number | string) => string) {
  const assignments = (await listWorkspaceSurveyVersionAssignments(token, workspaceId)).filter((assignment) => assignment.unassigned_at === null);
  if (assignments.length === 0) return [];
  const assignedIds = new Set(assignments.map((assignment) => assignment.survey_version_id));
  const surveys = await listSurveys(token);
  const versions = await Promise.all(surveys.map(async (survey) => ({ survey, versions: await listPublishedSurveyVersions(token, survey.id) })));
  return versions.flatMap(({ survey, versions: publishedVersions }) =>
    publishedVersions
      .filter((version) => version.status === "published" && assignedIds.has(version.id))
      .map((version) => ({ id: version.id, label: versionLabel(survey.title, version.version_number ?? "—") })),
  );
}

export default async function CampaignDetailPage(props: PageProps<"/workspaces/[workspaceId]/campaigns/[campaignId]">) {
  const { workspaceId, campaignId } = await props.params;
  const query = await props.searchParams;
  const token = await getAccessToken();
  if (!token) return null;
  const t = await getTranslations("campaigns");
  const format = await getFormatter();
  const versionLabel = (survey: string, number: number | string) => t("versionLine", { survey, number });

  const workspace = await resolveWorkspaceBySlug(token, workspaceId);

  const [campaign, template, assignedRecipients, workspaceRecipients, deliveries, surveyVersionOptions] = await Promise.all([
    getCampaign(token, campaignId),
    getCampaignEmailTemplate(token, campaignId),
    listCampaignRecipients(token, campaignId),
    listRecipients(token, workspace.id),
    listCampaignDeliveries(token, campaignId),
    loadAssignedSurveyVersionOptions(token, workspace.id, versionLabel),
  ]);

  let analytics: CampaignAnalytics | null = null;
  try {
    analytics = await getCampaignAnalytics(token, workspace.id, campaignId);
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 403)) throw error;
  }

  const link = buildPublicSurveyUrl(workspace.slug, campaign.public_path ?? campaign.public_slug);
  const totals = { queued: deliveries.filter((delivery) => delivery.status === "queued" || delivery.status === "sending").length, sent: deliveries.filter((delivery) => delivery.status === "sent").length, failed: deliveries.filter((delivery) => delivery.status === "failed").length };
  const hasDeliveries = deliveries.length > 0;
  const editable = (campaign.status === "draft" || campaign.status === "scheduled") && !hasDeliveries;
  const hasResponses = (analytics?.started_count ?? 0) > 0;
  const assignedIds = new Set(assignedRecipients.map((item) => item.recipient_id));
  const availableRecipients = workspaceRecipients.filter((item) => item.status === "active" && !assignedIds.has(item.id));
  const hasFailedDeliveries = deliveries.some((delivery) => delivery.status === "failed");
  const endDateEditable = campaign.status !== "completed" && campaign.status !== "cancelled";
  const imported = typeof query.created === "string";
  const errorParam = typeof query.error === "string" ? query.error : undefined;
  const statusParam = typeof query.status === "string" ? query.status : undefined;
  const emailMessage = emailErrorMessage(t, errorParam, statusParam);
  const sendMessage = sendErrorMessage(t, errorParam, statusParam);
  const statusMessage = statusErrorMessage(t, errorParam, statusParam);
  const sentCount = typeof query.sent === "string" ? Number(query.sent) : null;
  const activeTab = typeof query.tab === "string" ? query.tab : "overview";
  const formatDate = (value: string) => format.dateTime(new Date(value), { dateStyle: "medium", timeStyle: "short" });
  const statusOptions = campaignStatuses.filter((value) => hasDeliveries ? value !== "draft" && value !== "scheduled" : true);
  const deliveryStatusLabel = (status: string) => (["queued", "sending", "sent", "failed"].includes(status) ? t(`detail.deliveryStatus.${status as "queued"}`) : status);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-7 sm:px-6 lg:py-10">
      <Button nativeButton={false} variant="ghost" className="w-fit" render={<Link href={`/workspaces/${workspaceId}/campaigns`} />}>{t("detail.back")}</Button>
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{t("detail.eyebrow", { status: t(`status.${campaign.status}`) })}</p>
          <h1 className="mt-2 text-3xl font-semibold">{campaign.title}</h1>
          <p className="mt-2 text-muted-foreground">{versionLabel(campaign.survey_title, campaign.survey_version_number ?? "—")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ChangeSurveyVersionDialog campaignId={campaign.id} currentSurveyVersionId={campaign.survey_version_id} currentLabel={versionLabel(campaign.survey_title, campaign.survey_version_number ?? "—")} options={surveyVersionOptions} changeAction={changeCampaignSurveyVersionAction.bind(null, workspaceId)} disabled={!editable || hasResponses} />
          <DeleteCampaignDialog campaignId={campaign.id} campaignTitle={campaign.title} deleteAction={deleteCampaignAction.bind(null, workspaceId)} disabled={hasResponses} />
        </div>
      </section>

      <Tabs defaultValue={activeTab}>
        <TabsList>
          <TabsTrigger value="overview">{t("detail.tabs.overview")}</TabsTrigger>
          <TabsTrigger value="recipients">{t("detail.tabs.recipients", { count: assignedRecipients.length })}</TabsTrigger>
          <TabsTrigger value="email">{t("detail.tabs.email")}</TabsTrigger>
          <TabsTrigger value="deliveries">{t("detail.tabs.deliveries")}</TabsTrigger>
          <TabsTrigger value="analytics">{t("detail.tabs.analytics")}</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="flex flex-col gap-6 pt-4">
          {sendMessage ? <Alert variant="destructive"><AlertTitle>{t("detail.sendFailedTitle")}</AlertTitle><AlertDescription>{sendMessage}</AlertDescription></Alert> : null}
          {statusMessage ? <Alert variant="destructive"><AlertTitle>{t("detail.statusNotChanged")}</AlertTitle><AlertDescription>{statusMessage}</AlertDescription></Alert> : null}
          {sentCount !== null ? <Alert><AlertTitle>{t("detail.sendStarted")}</AlertTitle><AlertDescription>{sentCount > 0 ? t("detail.sentCount", { count: sentCount }) : t("detail.sentNone")} {t("detail.sentStatusNote")}</AlertDescription></Alert> : null}
          {hasResponses ? <Alert><AlertTitle>{t("detail.runningTitle")}</AlertTitle><AlertDescription>{t("detail.runningBody")}</AlertDescription></Alert> : null}
          <div className="flex flex-wrap gap-2"><SendCampaignDialog campaignTitle={campaign.title} recipientCount={assignedRecipients.length} subject={template?.subject ?? ""} action={queueCampaignDeliveriesAction.bind(null, workspaceId, campaign.id)} /></div>
          <Card><CardHeader><CardTitle>{t("detail.deliveryOverview")}</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-3"><p><span className="block text-2xl font-semibold">{totals.queued}</span><span className="text-sm text-muted-foreground">{t("detail.queued")}</span></p><p><span className="block text-2xl font-semibold">{totals.sent}</span><span className="text-sm text-muted-foreground">{t("detail.sent")}</span></p><p><span className="block text-2xl font-semibold">{totals.failed}</span><span className="text-sm text-muted-foreground">{t("detail.failed")}</span></p></CardContent></Card>
           <Card><CardHeader><CardTitle>{t("detail.publicLink")}</CardTitle></CardHeader><CardContent className="flex flex-wrap items-center gap-3"><code className="rounded bg-muted px-3 py-2 text-sm">{link}</code><Button nativeButton={false} variant="outline" render={<a href={link} target="_blank" rel="noreferrer" />}><ExternalLinkIcon data-icon="inline-start" />{t("detail.open")}</Button></CardContent></Card>
           <Card><CardHeader><CardTitle>{t("detail.runtime")}</CardTitle><CardDescription>{campaign.ends_at ? t("detail.endsOn", { date: formatDate(campaign.ends_at) }) : t("detail.noEnd")}</CardDescription></CardHeader><CardContent>{endDateEditable ? <CampaignEndDateForm endsAt={campaign.ends_at} action={updateCampaignEndDateAction.bind(null, workspaceId, campaign.id)} /> : <p className="text-sm text-muted-foreground">{t("detail.locked")}</p>}</CardContent></Card>
           <Card><CardHeader><CardTitle>{t("detail.statusTitle")}</CardTitle><CardDescription>{hasDeliveries ? t("detail.statusSentHint") : t("detail.statusEditHint")}</CardDescription></CardHeader><CardContent className="flex flex-wrap gap-2">{statusOptions.map((value) => <form key={value} action={changeCampaignStatusAction.bind(null, workspaceId, campaign.id)}><input type="hidden" name="status" value={value} /><Button type="submit" variant={campaign.status === value ? "default" : "outline"}>{t(`status.${value}`)}</Button></form>)}</CardContent></Card>
        </TabsContent>

        <TabsContent value="recipients" className="flex flex-col gap-6 pt-4">
          {imported ? <Alert><AlertTitle>{t("detail.importDone")}</AlertTitle><AlertDescription>{t("detail.importSummary", { created: String(query.created), duplicates: String(query.duplicates ?? 0), assigned: String(query.assigned ?? 0) })}</AlertDescription></Alert> : null}
          {query.error === "recipients" || query.error === "file-size" ? <Alert variant="destructive"><AlertTitle>{t("detail.importFailed")}</AlertTitle><AlertDescription>{t("detail.importFailedBody")}</AlertDescription></Alert> : null}
          <Card>
            <CardHeader><CardTitle>{t("detail.importTitle")}</CardTitle></CardHeader>
            <CardContent>{editable ? <RecipientImportForm action={importCampaignRecipientsAction.bind(null, workspaceId, campaign.id)} /> : <p className="text-sm text-muted-foreground">{t("detail.notEditable")}</p>}</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>{t("detail.addTitle")}</CardTitle></CardHeader>
            <CardContent>
              {editable && availableRecipients.length ? (
                <form action={assignCampaignRecipientsAction.bind(null, workspaceId, campaign.id)} className="flex flex-col gap-3">
                  <div className="max-h-80 overflow-y-auto rounded-md border">{availableRecipients.map((item) => <label key={item.id} className="flex items-center gap-3 border-b px-3 py-2 last:border-0"><input name="recipientId" type="checkbox" value={item.id} /><span>{item.display_name || item.email}{item.display_name ? <span className="text-muted-foreground"> · {item.email}</span> : null}</span></label>)}</div>
                  <Button className="w-fit" type="submit">{t("detail.addSelection")}</Button>
                </form>
              ) : <p className="text-sm text-muted-foreground">{t("detail.noneAvailable")}</p>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>{t("detail.selected", { count: assignedRecipients.length })}</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-2">
              {assignedRecipients.length ? assignedRecipients.map((item) => <div key={item.id} className="flex items-center gap-3 rounded-md border px-3 py-2"><span className="min-w-0 flex-1 truncate">{item.display_name || item.email}{item.display_name ? <span className="text-muted-foreground"> · {item.email}</span> : null}</span><span className="text-xs text-muted-foreground">{item.status}</span>{editable ? <form action={removeCampaignRecipientAction.bind(null, workspaceId, campaign.id, item.recipient_id)}><Button type="submit" size="sm" variant="ghost">{t("detail.remove")}</Button></form> : null}</div>) : <p className="text-sm text-muted-foreground">{t("detail.noneSelected")}</p>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="email" className="flex flex-col gap-6 pt-4">
          {emailMessage ? <Alert variant="destructive"><AlertTitle>{t("detail.errorTitle")}</AlertTitle><AlertDescription>{emailMessage}</AlertDescription></Alert> : null}
          {query.test === "sent" ? <Alert><AlertTitle>{t("detail.testSent")}</AlertTitle><AlertDescription>{t("detail.testSentBody")}</AlertDescription></Alert> : null}
          {editable ? (
            <EmailTemplateEditor campaignTitle={campaign.title} template={template} saveAction={saveCampaignEmailTemplateAction.bind(null, workspaceId, campaign.id)} testAction={testCampaignEmailTemplateAction.bind(null, workspaceId, campaign.id)} />
          ) : <p className="text-sm text-muted-foreground">{t("detail.notEditable")}</p>}
        </TabsContent>

        <TabsContent value="deliveries" className="flex flex-col gap-6 pt-4">
          {hasFailedDeliveries ? <form action={retryFailedCampaignDeliveriesAction.bind(null, workspaceId, campaign.id)}><Button type="submit" variant="outline">{t("detail.retry")}</Button></form> : null}
          <Card><CardHeader><CardTitle>{t("detail.deliveriesCount", { count: deliveries.length })}</CardTitle></CardHeader><CardContent className="overflow-x-auto"><table className="w-full min-w-160 text-left text-sm"><thead className="border-b text-muted-foreground"><tr><th className="p-3">{t("detail.colRecipient")}</th><th className="p-3">{t("detail.colStatus")}</th><th className="p-3">{t("detail.colAttempts")}</th><th className="p-3">{t("detail.colTime")}</th><th className="p-3">{t("detail.colNote")}</th></tr></thead><tbody>{deliveries.map((delivery) => <tr key={delivery.id} className="border-b last:border-0"><td className="p-3"><span className="block font-medium">{delivery.display_name ?? t("detail.noName")}</span><span className="text-muted-foreground">{delivery.email}</span></td><td className="p-3">{deliveryStatusLabel(delivery.status)}</td><td className="p-3">{delivery.attempt_count}</td><td className="p-3">{delivery.sent_at ? formatDate(delivery.sent_at) : delivery.queued_at ? formatDate(delivery.queued_at) : "–"}</td><td className="p-3 text-muted-foreground">{delivery.last_error ?? "–"}</td></tr>)}</tbody></table></CardContent></Card>
        </TabsContent>

        <TabsContent value="analytics" className="flex flex-col gap-6 pt-4">
          {analytics ? (
            <>
              <AnalyticsExportActions workspaceId={workspace.id} campaignId={campaign.id} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Card><CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">{t("detail.started")}</CardTitle><p className="mt-1 text-3xl font-semibold">{analytics.started_count}</p></CardHeader></Card>
                <Card><CardHeader><CardTitle className="text-sm font-medium text-muted-foreground">{t("detail.completed")}</CardTitle><p className="mt-1 text-3xl font-semibold">{analytics.completed_count}</p></CardHeader></Card>
              </div>
              <section className="grid gap-4">{analytics.questions.map((question) => <AnalyticsQuestionCard key={question.question_id} question={question} />)}</section>
            </>
          ) : (
            <Badge variant="secondary">{t("detail.noPermission")}</Badge>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
