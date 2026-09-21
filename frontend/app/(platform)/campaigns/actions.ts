"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createCampaign, deleteCampaign, updateCampaign } from "@/lib/api/client";
import { getAccessToken } from "@/lib/auth/session";

async function token() { const value = await getAccessToken(); if (!value) redirect("/login"); return value; }
const text = (formData: FormData, name: string) => String(formData.get(name) ?? "").trim();

export async function createCampaignAction(formData: FormData) {
  const clinicId = text(formData, "clinicId"); const surveyVersionId = text(formData, "surveyVersionId"); const title = text(formData, "title");
  if (!clinicId || !surveyVersionId || !title) redirect("/campaigns/new?error=validation");
  try { const campaign = await createCampaign(await token(), { clinic_id: clinicId, survey_version_id: surveyVersionId, title, description: text(formData, "description") || null }); revalidatePath("/campaigns"); redirect(`/campaigns/${campaign.id}`); } catch { redirect("/campaigns/new?error=create"); }
}

export async function changeCampaignStatusAction(campaignId: string, formData: FormData) {
  const status = text(formData, "status") as "active" | "paused" | "completed" | "cancelled";
  try { await updateCampaign(await token(), campaignId, { status }); } catch { redirect(`/campaigns/${campaignId}?error=status`); }
  revalidatePath("/campaigns"); revalidatePath(`/campaigns/${campaignId}`); redirect(`/campaigns/${campaignId}`);
}

export async function deleteCampaignAction(campaignId: string) {
  try { await deleteCampaign(await token(), campaignId); } catch { redirect(`/campaigns/${campaignId}?error=delete`); }
  revalidatePath("/campaigns"); redirect("/campaigns");
}
