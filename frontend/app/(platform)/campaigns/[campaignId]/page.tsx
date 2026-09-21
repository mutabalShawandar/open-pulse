import { ExternalLinkIcon } from "lucide-react";
import { DeleteCampaignDialog } from "@/components/campaigns/delete-campaign-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { changeCampaignStatusAction } from "../actions";
import { getCampaign } from "@/lib/api/client";
import { getAccessToken } from "@/lib/auth/session";

export default async function CampaignPage(props: PageProps<"/campaigns/[campaignId]">) {
  const { campaignId } = await props.params;
  const token = await getAccessToken();
  if (!token) return null;
  const campaign = await getCampaign(token, campaignId);
  const link = `/umfragen/${campaign.public_slug}`;
  return <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-7 sm:px-6 lg:py-10"><section className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm text-muted-foreground">Kampagne · {campaign.status}</p><h1 className="mt-2 text-3xl font-semibold">{campaign.title}</h1><p className="mt-2 text-muted-foreground">{campaign.survey_title} · Version {campaign.survey_version_number}</p></div><DeleteCampaignDialog campaignId={campaign.id} campaignTitle={campaign.title} /></section><Card><CardHeader><CardTitle>Öffentlicher Umfragelink</CardTitle></CardHeader><CardContent className="flex flex-wrap items-center gap-3"><code className="rounded bg-muted px-3 py-2 text-sm">{link}</code><Button nativeButton={false} variant="outline" render={<a href={link} target="_blank" rel="noreferrer" />}><ExternalLinkIcon data-icon="inline-start" />Öffnen</Button><p className="w-full text-sm text-muted-foreground">Diesen Link können Sie mit Teilnehmenden teilen, sobald die Kampagne aktiv ist.</p></CardContent></Card><Card><CardHeader><CardTitle>Status</CardTitle></CardHeader><CardContent className="flex flex-wrap gap-2">{["active", "paused", "completed", "cancelled"].map((status) => <form key={status} action={changeCampaignStatusAction.bind(null, campaign.id)}><input type="hidden" name="status" value={status} /><Button type="submit" variant={campaign.status === status ? "default" : "outline"}>{status}</Button></form>)}</CardContent></Card></div>;
}
