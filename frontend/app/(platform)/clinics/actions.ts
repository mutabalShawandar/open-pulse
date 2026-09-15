"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  ApiError,
  assignSurveyVersionToClinic,
  createClinic,
  unassignSurveyVersionFromClinic,
  updateClinic,
} from "@/lib/api/client";
import type { ClinicInput } from "@/lib/api/types";
import { getAccessToken } from "@/lib/auth/session";

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

  try {
    const clinic = await createClinic(accessToken, payload);
    revalidatePath("/");
    revalidatePath("/clinics");
    redirect(`/clinics/${clinic.id}?created=1`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) redirect("/access-denied");
    if (error instanceof ApiError && error.status === 409) redirect("/clinics/new?error=exists");
    redirect("/clinics/new?error=create");
  }
}

export async function updateClinicAction(clinicId: string, formData: FormData) {
  const payload = clinicInputFrom(formData);
  const accessToken = await getAccessToken();

  if (!accessToken) redirect("/login");
  if (!payload) redirect(`/clinics/${clinicId}/edit?error=validation`);

  try {
    await updateClinic(accessToken, clinicId, payload);
    revalidatePath("/");
    revalidatePath("/clinics");
    revalidatePath(`/clinics/${clinicId}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) redirect("/access-denied");
    if (error instanceof ApiError && error.status === 404) redirect("/clinics");
    if (error instanceof ApiError && error.status === 409) {
      redirect(`/clinics/${clinicId}/edit?error=exists`);
    }
    redirect(`/clinics/${clinicId}/edit?error=update`);
  }

  redirect(`/clinics/${clinicId}?updated=1`);
}

export async function assignSurveyVersionAction(clinicId: string, formData: FormData) {
  const surveyVersionId = String(formData.get("surveyVersionId") ?? "");
  const accessToken = await getAccessToken();

  if (!accessToken) redirect("/login");
  if (!surveyVersionId) redirect(`/clinics/${clinicId}?assignmentError=validation`);

  try {
    await assignSurveyVersionToClinic(accessToken, clinicId, surveyVersionId);
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) redirect("/access-denied");
    if (error instanceof ApiError && error.status === 409) {
      redirect(`/clinics/${clinicId}?assignmentError=exists`);
    }
    redirect(`/clinics/${clinicId}?assignmentError=assign`);
  }

  revalidatePath(`/clinics/${clinicId}`);
  redirect(`/clinics/${clinicId}?assignmentAdded=1`);
}

export async function unassignSurveyVersionAction(clinicId: string, formData: FormData) {
  const surveyVersionId = String(formData.get("surveyVersionId") ?? "");
  const accessToken = await getAccessToken();

  if (!accessToken) redirect("/login");
  if (!surveyVersionId) redirect(`/clinics/${clinicId}?assignmentError=unassign`);

  try {
    await unassignSurveyVersionFromClinic(accessToken, clinicId, surveyVersionId);
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) redirect("/access-denied");
    redirect(`/clinics/${clinicId}?assignmentError=unassign`);
  }

  revalidatePath(`/clinics/${clinicId}`);
  redirect(`/clinics/${clinicId}?assignmentRemoved=1`);
}
