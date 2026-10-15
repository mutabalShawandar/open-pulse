import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  ArrowLeftIcon,
  BarChart3Icon,
  CheckCircle2Icon,
  UsersIcon,
} from "lucide-react";
import { AnalyticsExportActions } from "@/components/workspaces/analytics-export-actions";
import { AnalyticsQuestionCard } from "@/components/workspaces/analytics-question-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError, getCampaignAnalytics, listCampaigns } from "@/lib/api/client";
import { getAccessToken } from "@/lib/auth/session";
import { resolveWorkspaceBySlug } from "@/lib/resolve-workspace";
import type { Campaign, CampaignAnalytics } from "@/lib/api/types";

export default async function WorkspaceAnalyticsPage(
  props: PageProps<"/workspaces/[workspaceId]/analytics">,
) {
  const { workspaceId: workspaceSlug } = await props.params;
  const t = await getTranslations("analytics");
  const campaignId = (await props.searchParams).campaign as string | undefined;
  const token = await getAccessToken();
  if (!token) redirect("/login");
  const workspace = await resolveWorkspaceBySlug(token, workspaceSlug);

  let campaigns: Campaign[] = [];
  try {
    campaigns = (await listCampaigns(token)).filter((campaign) => campaign.clinic_id === workspace.id);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect("/login");
    throw error;
  }

  const selectedCampaignId = campaignId ?? campaigns[0]?.id;
  let analytics: CampaignAnalytics | null = null;
  try {
    analytics = selectedCampaignId
      ? await getCampaignAnalytics(token, workspace.id, selectedCampaignId)
      : null;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) redirect("/login");
    throw error;
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-7 sm:px-6 lg:px-10 lg:py-10">
      <Button
        nativeButton={false}
        variant="ghost"
        className="w-fit"
        render={<Link href={`/workspaces/${workspaceSlug}`} />}
      >
        <ArrowLeftIcon data-icon="inline-start" />
        {t("back")}
      </Button>

      <header>
        <p className="text-sm font-medium text-primary">{t("eyebrow")}</p>
        <h1 className="mt-2 text-3xl font-semibold">{t("title")}</h1>
      </header>

      {campaigns.length ? (
        <>
          <nav className="flex flex-wrap gap-2" aria-label={t("selectCampaign")}>
            {campaigns.map((campaign) => (
              <Button
                key={campaign.id}
                nativeButton={false}
                variant={campaign.id === selectedCampaignId ? "default" : "outline"}
                render={<Link href={`/workspaces/${workspaceSlug}/analytics?campaign=${campaign.id}`} />}
              >
                {campaign.title}
              </Button>
            ))}
          </nav>

          {analytics ? (
            <>
              <AnalyticsExportActions workspaceId={workspace.id} campaignId={selectedCampaignId!} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Metric icon={<UsersIcon />} label={t("started")} value={analytics.started_count} />
                <Metric icon={<CheckCircle2Icon />} label={t("completed")} value={analytics.completed_count} />
              </div>
              <section className="grid gap-4">
                {analytics.questions.map((question) => (
                  <AnalyticsQuestionCard key={question.question_id} question={question} />
                ))}
              </section>
            </>
          ) : null}
        </>
      ) : (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-muted-foreground">
            <BarChart3Icon className="mx-auto mb-3 size-8" />
            {t("noCampaigns")}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-4">
        <div className="rounded-xl bg-primary/10 p-3 text-primary">{icon}</div>
        <div>
          <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
          <p className="mt-1 text-3xl font-semibold">{value}</p>
        </div>
      </CardHeader>
    </Card>
  );
}
