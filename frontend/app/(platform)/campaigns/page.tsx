import Link from "next/link";
import { MegaphoneIcon, PlusIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { listCampaigns } from "@/lib/api/client";
import { getAccessToken } from "@/lib/auth/session";

export default async function CampaignsPage() { const token = await getAccessToken(); const campaigns = token ? await listCampaigns(token) : []; return <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-7 sm:px-6 lg:px-10 lg:py-10"><section className="flex items-end justify-between"><div><p className="text-sm font-medium text-muted-foreground">Verteilung</p><h1 className="mt-2 font-heading text-3xl font-semibold tracking-tight">Kampagnen</h1></div><Button nativeButton={false} render={<Link href="/campaigns/new" />}><PlusIcon data-icon="inline-start" />Kampagne erstellen</Button></section>{campaigns.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{campaigns.map((campaign) => <Link key={campaign.id} href={`/campaigns/${campaign.id}`}><Card><CardHeader><Badge variant={campaign.status === "active" ? "default" : "secondary"}>{campaign.status}</Badge><CardTitle className="mt-4">{campaign.title}</CardTitle></CardHeader><CardContent className="text-sm text-muted-foreground">Öffentlichen Link und Status verwalten</CardContent></Card></Link>)}</div> : <Empty className="min-h-72 border bg-card"><EmptyHeader><EmptyMedia variant="icon"><MegaphoneIcon /></EmptyMedia><EmptyTitle>Noch keine Kampagnen</EmptyTitle><EmptyDescription>Erstellen Sie eine Kampagne aus einer einer Klinik zugewiesenen veröffentlichten Umfrage.</EmptyDescription></EmptyHeader></Empty>}</div>; }
