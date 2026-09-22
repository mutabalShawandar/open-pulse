"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  ApiError,
  assignCampaignRecipients,
  createCampaign,
  deleteCampaign,
  importRecipients,
  listRecipients,
  queueCampaignDeliveries,
  removeCampaignRecipient,
  retryFailedCampaignDeliveries,
  saveCampaignEmailTemplate,
  testCampaignEmailTemplate,
  updateCampaign,
} from "@/lib/api/client";
import { getAccessToken } from "@/lib/auth/session";
import { resolveClinicBySlug } from "@/lib/resolve-clinic";
import type { Recipient } from "@/lib/api/types";

async function token() { const value = await getAccessToken(); if (!value) redirect("/login"); return value; }
const text = (formData: FormData, name: string) => String(formData.get(name) ?? "").trim();

export async function changeCampaignStatusAction(clinicId: string, campaignId: string, formData: FormData) {
  const status = text(formData, "status") as "draft" | "scheduled" | "active" | "paused" | "completed" | "cancelled";
  try {
    await updateCampaign(await token(), campaignId, { status });
  } catch (error) {
    const statusCode = error instanceof ApiError ? error.status : "unknown";
    redirect(`/clinics/${clinicId}/campaigns/${campaignId}?error=status&status=${statusCode}`);
  }
  revalidatePath(`/clinics/${clinicId}/campaigns`); revalidatePath(`/clinics/${clinicId}/campaigns/${campaignId}`); redirect(`/clinics/${clinicId}/campaigns/${campaignId}`);
}

export async function changeCampaignSurveyVersionAction(clinicId: string, campaignId: string, formData: FormData) {
  const surveyVersionId = text(formData, "surveyVersionId");
  if (!surveyVersionId) redirect(`/clinics/${clinicId}/campaigns/${campaignId}?error=survey-version`);
  try { await updateCampaign(await token(), campaignId, { survey_version_id: surveyVersionId }); } catch { redirect(`/clinics/${clinicId}/campaigns/${campaignId}?error=survey-version`); }
  revalidatePath(`/clinics/${clinicId}/campaigns`); revalidatePath(`/clinics/${clinicId}/campaigns/${campaignId}`); redirect(`/clinics/${clinicId}/campaigns/${campaignId}`);
}

export async function deleteCampaignAction(clinicId: string, campaignId: string) {
  try { await deleteCampaign(await token(), campaignId); } catch { redirect(`/clinics/${clinicId}/campaigns/${campaignId}?error=delete`); }
  revalidatePath(`/clinics/${clinicId}/campaigns`); redirect(`/clinics/${clinicId}/campaigns`);
}

export async function importCampaignRecipientsAction(clinicSlug: string, campaignId: string, formData: FormData) {
  const file = formData.get("recipientFile");
  const hasFile = file instanceof File && file.size > 0;
  if (file instanceof File && file.size > 2 * 1024 * 1024) redirect(`/clinics/${clinicSlug}/campaigns/${campaignId}?tab=recipients&error=file-size`);
  const recipients = hasFile
    ? (await file.text()).replace(/^﻿/, "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((row) => {
      const [displayName, email] = row.includes(";") ? row.split(";", 2) : row.includes(",") ? row.split(",", 2) : ["", row];
      return { display_name: displayName.trim() || null, email: email.trim() };
    }).filter((recipient) => recipient.email.toLowerCase() !== "email" && recipient.email.toLowerCase() !== "e-mail")
    : formData.getAll("recipientEmail").map(String).map((email, index) => ({
      display_name: String(formData.getAll("recipientName")[index] ?? "").trim() || null,
      email: email.trim(),
    })).filter((recipient) => recipient.email);
  if (!recipients.length || recipients.length > 2_000) redirect(`/clinics/${clinicSlug}/campaigns/${campaignId}?tab=recipients&error=recipients`);
  let createdCount = 0;
  let duplicateCount = 0;
  let assignedCount = 0;
  try {
    const accessToken = await token();
    const clinic = await resolveClinicBySlug(accessToken, clinicSlug);
    const result = await importRecipients(accessToken, clinic.id, recipients);
    const importedEmails = new Set(recipients.map((recipient) => recipient.email.trim().toLowerCase()));
    const clinicRecipients = await listRecipients(accessToken, clinic.id);
    const recipientIds = clinicRecipients
      .filter((recipient) => recipient.status === "active" && importedEmails.has(recipient.email.trim().toLowerCase()))
      .map((recipient) => recipient.id);
    const assigned = recipientIds.length ? await assignCampaignRecipients(accessToken, campaignId, recipientIds) : [];
    createdCount = result.created_count;
    duplicateCount = result.duplicate_count;
    assignedCount = assigned.length;
  } catch {
    redirect(`/clinics/${clinicSlug}/campaigns/${campaignId}?tab=recipients&error=recipients`);
  }
  revalidatePath(`/clinics/${clinicSlug}/campaigns/${campaignId}`);
  redirect(`/clinics/${clinicSlug}/campaigns/${campaignId}?tab=recipients&created=${createdCount}&duplicates=${duplicateCount}&assigned=${assignedCount}`);
}

export async function assignCampaignRecipientsAction(clinicId: string, campaignId: string, formData: FormData) {
  const recipientIds = formData.getAll("recipientId").map(String);
  if (!recipientIds.length) redirect(`/clinics/${clinicId}/campaigns/${campaignId}?tab=recipients&error=selection`);
  try { await assignCampaignRecipients(await token(), campaignId, recipientIds); } catch { redirect(`/clinics/${clinicId}/campaigns/${campaignId}?tab=recipients&error=selection`); }
  revalidatePath(`/clinics/${clinicId}/campaigns/${campaignId}`); redirect(`/clinics/${clinicId}/campaigns/${campaignId}?tab=recipients`);
}

export async function removeCampaignRecipientAction(clinicId: string, campaignId: string, recipientId: string) {
  try { await removeCampaignRecipient(await token(), campaignId, recipientId); } catch { redirect(`/clinics/${clinicId}/campaigns/${campaignId}?tab=recipients&error=remove-recipient`); }
  revalidatePath(`/clinics/${clinicId}/campaigns/${campaignId}`); redirect(`/clinics/${clinicId}/campaigns/${campaignId}?tab=recipients`);
}

export async function saveCampaignEmailTemplateAction(clinicId: string, campaignId: string, formData: FormData) {
  try {
    await saveCampaignEmailTemplate(await token(), campaignId, { subject: text(formData, "subject"), html_body: text(formData, "htmlBody"), text_body: text(formData, "textBody"), sender_name: text(formData, "senderName") || null, reply_to: text(formData, "replyTo") || null });
  } catch (error) {
    const status = error instanceof ApiError ? error.status : "unknown";
    redirect(`/clinics/${clinicId}/campaigns/${campaignId}?tab=email&error=template&status=${status}`);
  }
  revalidatePath(`/clinics/${clinicId}/campaigns/${campaignId}`); redirect(`/clinics/${clinicId}/campaigns/${campaignId}?tab=email`);
}

export async function testCampaignEmailTemplateAction(clinicId: string, campaignId: string, formData: FormData) {
  const recipientEmail = text(formData, "recipientEmail");
  try {
    await testCampaignEmailTemplate(await token(), campaignId, recipientEmail);
  } catch (error) {
    const status = error instanceof ApiError ? error.status : "unknown";
    redirect(`/clinics/${clinicId}/campaigns/${campaignId}?tab=email&error=test&status=${status}`);
  }
  redirect(`/clinics/${clinicId}/campaigns/${campaignId}?tab=email&test=sent`);
}

export async function queueCampaignDeliveriesAction(clinicId: string, campaignId: string) {
  let queuedCount = 0;
  try {
    const result = await queueCampaignDeliveries(await token(), campaignId);
    queuedCount = result.queued_count;
  } catch (error) {
    const status = error instanceof ApiError ? error.status : "unknown";
    redirect(`/clinics/${clinicId}/campaigns/${campaignId}?error=send&status=${status}`);
  }
  revalidatePath(`/clinics/${clinicId}/campaigns/${campaignId}`);
  redirect(`/clinics/${clinicId}/campaigns/${campaignId}?sent=${queuedCount}`);
}

export async function retryFailedCampaignDeliveriesAction(clinicId: string, campaignId: string) {
  try { await retryFailedCampaignDeliveries(await token(), campaignId); } catch { redirect(`/clinics/${clinicId}/campaigns/${campaignId}?tab=deliveries&error=retry`); }
  revalidatePath(`/clinics/${clinicId}/campaigns/${campaignId}`);
  redirect(`/clinics/${clinicId}/campaigns/${campaignId}?tab=deliveries`);
}

// --- Wizard: non-redirecting variants callable directly from the client wizard ---

export type WizardImportResult = { ok: true; createdCount: number; duplicateCount: number; recipients: Recipient[] } | { ok: false; error: string };

export async function importWizardRecipientsAction(clinicSlug: string, recipients: { display_name: string | null; email: string }[]): Promise<WizardImportResult> {
  if (!recipients.length || recipients.length > 2_000) return { ok: false, error: "Bitte prüfen Sie das Format und die maximale Anzahl von 2.000 Empfängern." };
  try {
    const accessToken = await token();
    const clinic = await resolveClinicBySlug(accessToken, clinicSlug);
    const result = await importRecipients(accessToken, clinic.id, recipients);
    const clinicRecipients = await listRecipients(accessToken, clinic.id);
    return { ok: true, createdCount: result.created_count, duplicateCount: result.duplicate_count, recipients: clinicRecipients.filter((recipient) => recipient.status === "active") };
  } catch {
    return { ok: false, error: "Der Import konnte nicht verarbeitet werden." };
  }
}

export type WizardSubmitPayload = {
  clinicId: string;
  title: string;
  description: string;
  surveyVersionId: string;
  recipientIds: string[];
  email: { subject: string; htmlBody: string; textBody: string; senderName: string; replyTo: string } | null;
};

export type WizardSubmitResult = { ok: true; campaignId: string } | { ok: false; error: string };

export async function submitCampaignWizardAction(payload: WizardSubmitPayload): Promise<WizardSubmitResult> {
  if (!payload.title.trim() || !payload.surveyVersionId) return { ok: false, error: "Titel und Umfrageversion sind erforderlich." };
  const accessToken = await token();
  const clinic = await resolveClinicBySlug(accessToken, payload.clinicId);
  let campaignId: string;
  try {
    const campaign = await createCampaign(accessToken, { clinic_id: clinic.id, survey_version_id: payload.surveyVersionId, title: payload.title.trim(), description: payload.description.trim() || null });
    campaignId = campaign.id;
  } catch {
    return { ok: false, error: "Die Kampagne konnte nicht erstellt werden. Bitte prüfen Sie die ausgewählte Umfrageversion." };
  }
  if (payload.recipientIds.length) {
    try { await assignCampaignRecipients(accessToken, campaignId, payload.recipientIds); } catch { /* recipients can still be added later on the detail page */ }
  }
  if (payload.email && payload.email.subject.trim() && payload.email.htmlBody.trim() && payload.email.textBody.trim()) {
    try {
      await saveCampaignEmailTemplate(accessToken, campaignId, { subject: payload.email.subject.trim(), html_body: payload.email.htmlBody.trim(), text_body: payload.email.textBody.trim(), sender_name: payload.email.senderName.trim() || null, reply_to: payload.email.replyTo.trim() || null });
    } catch { /* template can still be saved later on the detail page */ }
  }
  revalidatePath(`/clinics/${payload.clinicId}/campaigns`);
  return { ok: true, campaignId };
}
