import Link from "next/link";
import { notFound } from "next/navigation";
import { PlusIcon } from "lucide-react";

import { CampaignsList } from "@/components/campaigns/campaigns-list";
import { Button } from "@/components/ui/button";
import { ApiError, getClinic, listCampaigns } from "@/lib/api/client";
import { getAccessToken } from "@/lib/auth/session";

export default async function ClinicCampaignsPage(props: PageProps<"/clinics/[clinicId]/campaigns">) {
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
  const campaigns = (await listCampaigns(token)).filter((campaign) => campaign.clinic_id === clinicId);
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-7 sm:px-6 lg:px-10 lg:py-10">
      <Button nativeButton={false} variant="ghost" className="w-fit" render={<Link href={`/clinics/${clinicId}`} />}>← Zur Klinik</Button>
      <section className="flex items-end justify-between">
        <div><p className="text-sm font-medium text-muted-foreground">{clinic.name}</p><h1 className="mt-2 font-heading text-3xl font-semibold tracking-tight">Kampagnen</h1></div>
        <Button nativeButton={false} render={<Link href={`/clinics/${clinicId}/campaigns/new`} />}><PlusIcon data-icon="inline-start" />Kampagne erstellen</Button>
      </section>
      <CampaignsList clinicId={clinicId} campaigns={campaigns} />
    </div>
  );
}
