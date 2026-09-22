"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  ApiError,
  assignSurveyVersionToClinic,
  createClinic,
  importRecipients,
  optOutRecipient,
  unassignSurveyVersionFromClinic,
  updateClinic,
} from "@/lib/api/client";
import type { ClinicInput } from "@/lib/api/types";
import { getAccessToken } from "@/lib/auth/session";
import { resolveClinicBySlug } from "@/lib/resolve-clinic";

function optionalValue(formData: FormData, field: string) {
  const value = String(formData.get(field) ?? "").trim();
  return value || null;
}

function clinicInputFrom(formData: FormData): ClinicInput | null {
  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  const houseNumberValue = optionalValue(formData, "hausnummer");
  const hausnummer = houseNumberValue === null ? null : Number(houseNumberValue);

  if (!name || !slug || (hausnummer !== null && (!Number.isInteger(hausnummer) || hausnummer < 1))) {
    return null;
  }

  return {
    name,
    slug,
    logo_url: optionalValue(formData, "logoUrl"),
    street: optionalValue(formData, "street"),
    hausnummer,
    city: optionalValue(formData, "city"),
    postal_code: optionalValue(formData, "postalCode"),
  };
}

export async function createClinicAction(formData: FormData) {
  const payload = clinicInputFrom(formData);
  const accessToken = await getAccessToken();

  if (!accessToken) redirect("/login");
  if (!payload) redirect("/clinics/new?error=validation");

  let clinicSlug: string;
  try {
    const clinic = await createClinic(accessToken, payload);
    clinicSlug = clinic.slug;
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) redirect("/access-denied");
    if (error instanceof ApiError && error.status === 409) redirect("/clinics/new?error=exists");
    redirect("/clinics/new?error=create");
  }
  revalidatePath("/");
  revalidatePath("/clinics");
  redirect(`/clinics/${clinicSlug}?created=1`);
}

export async function updateClinicAction(clinicSlug: string, formData: FormData) {
  const payload = clinicInputFrom(formData);
  const accessToken = await getAccessToken();

  if (!accessToken) redirect("/login");
  if (!payload) redirect(`/clinics/${clinicSlug}/edit?error=validation`);

  let updatedSlug = clinicSlug;
  try {
    const clinic = await resolveClinicBySlug(accessToken, clinicSlug);
    const updated = await updateClinic(accessToken, clinic.id, payload);
    updatedSlug = updated.slug;
    revalidatePath("/");
    revalidatePath("/clinics");
    revalidatePath(`/clinics/${clinicSlug}`);
    if (updatedSlug !== clinicSlug) revalidatePath(`/clinics/${updatedSlug}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) redirect("/access-denied");
    if (error instanceof ApiError && error.status === 404) redirect("/clinics");
    if (error instanceof ApiError && error.status === 409) {
      redirect(`/clinics/${clinicSlug}/edit?error=exists`);
    }
    redirect(`/clinics/${clinicSlug}/edit?error=update`);
  }

  redirect(`/clinics/${updatedSlug}?updated=1`);
}

export async function assignSurveyVersionAction(clinicSlug: string, formData: FormData) {
  const surveyVersionId = String(formData.get("surveyVersionId") ?? "");
  const accessToken = await getAccessToken();

  if (!accessToken) redirect("/login");
  if (!surveyVersionId) redirect(`/clinics/${clinicSlug}?assignmentError=validation`);

  try {
    const clinic = await resolveClinicBySlug(accessToken, clinicSlug);
    await assignSurveyVersionToClinic(accessToken, clinic.id, surveyVersionId);
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) redirect("/access-denied");
    if (error instanceof ApiError && error.status === 409) {
      redirect(`/clinics/${clinicSlug}?assignmentError=exists`);
    }
    redirect(`/clinics/${clinicSlug}?assignmentError=assign`);
  }

  revalidatePath(`/clinics/${clinicSlug}`);
  redirect(`/clinics/${clinicSlug}?assignmentAdded=1`);
}

export async function unassignSurveyVersionAction(clinicSlug: string, formData: FormData) {
  const surveyVersionId = String(formData.get("surveyVersionId") ?? "");
  const accessToken = await getAccessToken();

  if (!accessToken) redirect("/login");
  if (!surveyVersionId) redirect(`/clinics/${clinicSlug}?assignmentError=unassign`);

  try {
    const clinic = await resolveClinicBySlug(accessToken, clinicSlug);
    await unassignSurveyVersionFromClinic(accessToken, clinic.id, surveyVersionId);
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) redirect("/access-denied");
    redirect(`/clinics/${clinicSlug}?assignmentError=unassign`);
  }

  revalidatePath(`/clinics/${clinicSlug}`);
  redirect(`/clinics/${clinicSlug}?assignmentRemoved=1`);
}

export async function importClinicRecipientsAction(clinicSlug: string, formData: FormData) {
  const file = formData.get("recipientFile");
  const hasFile = file instanceof File && file.size > 0;
  if (file instanceof File && file.size > 2 * 1024 * 1024) redirect(`/clinics/${clinicSlug}/recipients?error=file-size`);
  const recipients = hasFile
    ? (await file.text()).replace(/^﻿/, "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((row) => {
      const [displayName, email] = row.includes(";") ? row.split(";", 2) : row.includes(",") ? row.split(",", 2) : ["", row];
      return { display_name: displayName.trim() || null, email: email.trim() };
    }).filter((recipient) => recipient.email.toLowerCase() !== "email" && recipient.email.toLowerCase() !== "e-mail")
    : formData.getAll("recipientEmail").map(String).map((email, index) => ({
      display_name: String(formData.getAll("recipientName")[index] ?? "").trim() || null,
      email: email.trim(),
    })).filter((recipient) => recipient.email);
  if (!recipients.length || recipients.length > 2_000) redirect(`/clinics/${clinicSlug}/recipients?error=recipients`);

  const accessToken = await getAccessToken();
  if (!accessToken) redirect("/login");
  let createdCount: number;
  let duplicateCount: number;
  try {
    const clinic = await resolveClinicBySlug(accessToken, clinicSlug);
    const result = await importRecipients(accessToken, clinic.id, recipients);
    createdCount = result.created_count;
    duplicateCount = result.duplicate_count;
  } catch {
    redirect(`/clinics/${clinicSlug}/recipients?error=recipients`);
  }
  revalidatePath(`/clinics/${clinicSlug}/recipients`);
  redirect(`/clinics/${clinicSlug}/recipients?created=${createdCount}&duplicates=${duplicateCount}`);
}

export async function optOutClinicRecipientAction(clinicSlug: string, recipientId: string) {
  const accessToken = await getAccessToken();
  if (!accessToken) redirect("/login");
  try {
    const clinic = await resolveClinicBySlug(accessToken, clinicSlug);
    await optOutRecipient(accessToken, clinic.id, recipientId);
  } catch {
    redirect(`/clinics/${clinicSlug}/recipients?error=opt-out`);
  }
  revalidatePath(`/clinics/${clinicSlug}/recipients`);
  redirect(`/clinics/${clinicSlug}/recipients?optedOut=1`);
}
