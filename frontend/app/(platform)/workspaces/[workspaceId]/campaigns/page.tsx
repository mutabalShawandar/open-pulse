import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { CampaignsList } from "@/components/campaigns/campaigns-list";
import { Button } from "@/components/ui/button";
import { listCampaigns } from "@/lib/api/client";
import { getAccessToken } from "@/lib/auth/session";
import { resolveWorkspaceBySlug } from "@/lib/resolve-workspace";

export default async function WorkspaceCampaignsPage(props: PageProps<"/workspaces/[workspaceId]/campaigns">) {
  const { workspaceId: workspaceSlug } = await props.params;
  const token = await getAccessToken();
  if (!token) return null;
  const t = await getTranslations("campaigns.page");
  const workspace = await resolveWorkspaceBySlug(token, workspaceSlug);
  const campaigns = (await listCampaigns(token)).filter((campaign) => campaign.clinic_id === workspace.id);
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-7 sm:px-6 lg:px-10 lg:py-10">
      <Button nativeButton={false} variant="ghost" className="w-fit" render={<Link href={`/workspaces/${workspaceSlug}`} />}>{t("toWorkspace")}</Button>
      <section className="flex items-end justify-between">
        <div><p className="text-sm font-medium text-muted-foreground">{workspace.name}</p><h1 className="mt-2 font-heading text-3xl font-semibold tracking-tight">{t("title")}</h1></div>
        <Button nativeButton={false} render={<Link href={`/workspaces/${workspaceSlug}/campaigns/new`} />}><PlusIcon data-icon="inline-start" />{t("create")}</Button>
      </section>
      <CampaignsList workspaceId={workspaceSlug} campaigns={campaigns} />
    </div>
  );
}
