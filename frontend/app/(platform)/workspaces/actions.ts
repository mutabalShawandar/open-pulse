"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  ApiError,
  assignSurveyVersionToWorkspace,
  createWorkspace,
  importRecipients,
  optOutRecipient,
  unassignSurveyVersionFromWorkspace,
  updateWorkspace,
  uploadWorkspaceLogo,
} from "@/lib/api/client";
import type { WorkspaceInput } from "@/lib/api/types";
import { getAccessToken } from "@/lib/auth/session";
import { resolveWorkspaceBySlug } from "@/lib/resolve-workspace";

function optionalValue(formData: FormData, field: string) {
  const value = String(formData.get(field) ?? "").trim();
  return value || null;
}

function workspaceInputFrom(formData: FormData): WorkspaceInput | null {
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
    street: optionalValue(formData, "street"),
    hausnummer,
    city: optionalValue(formData, "city"),
    postal_code: optionalValue(formData, "postalCode"),
  };
}

function uploadedLogo(formData: FormData): File | null {
  const logo = formData.get("logo");
  return logo instanceof File && logo.size > 0 ? logo : null;
}

export async function createWorkspaceAction(formData: FormData) {
  const payload = workspaceInputFrom(formData);
  const accessToken = await getAccessToken();

  if (!accessToken) redirect("/login");
  if (!payload) redirect("/workspaces/new?error=validation");

  let workspaceSlug: string;
  try {
    const workspace = await createWorkspace(accessToken, payload);
    const logo = uploadedLogo(formData);
    if (logo) await uploadWorkspaceLogo(accessToken, workspace.id, logo);
    workspaceSlug = workspace.slug;
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) redirect("/access-denied");
    if (error instanceof ApiError && error.status === 409) redirect("/workspaces/new?error=exists");
    redirect("/workspaces/new?error=create");
  }
  revalidatePath("/");
  revalidatePath("/workspaces");
  redirect(`/workspaces/${workspaceSlug}?created=1`);
}

export async function updateWorkspaceAction(workspaceSlug: string, formData: FormData) {
  const payload = workspaceInputFrom(formData);
  const accessToken = await getAccessToken();

  if (!accessToken) redirect("/login");
  if (!payload) redirect(`/workspaces/${workspaceSlug}/edit?error=validation`);

  let updatedSlug = workspaceSlug;
  try {
    const workspace = await resolveWorkspaceBySlug(accessToken, workspaceSlug);
    const updated = await updateWorkspace(accessToken, workspace.id, payload);
    const logo = uploadedLogo(formData);
    if (logo) await uploadWorkspaceLogo(accessToken, workspace.id, logo);
    updatedSlug = updated.slug;
    revalidatePath("/");
    revalidatePath("/workspaces");
    revalidatePath(`/workspaces/${workspaceSlug}`);
    if (updatedSlug !== workspaceSlug) revalidatePath(`/workspaces/${updatedSlug}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) redirect("/access-denied");
    if (error instanceof ApiError && error.status === 404) redirect("/workspaces");
    if (error instanceof ApiError && error.status === 409) {
      redirect(`/workspaces/${workspaceSlug}/edit?error=exists`);
    }
    redirect(`/workspaces/${workspaceSlug}/edit?error=update`);
  }

  redirect(`/workspaces/${updatedSlug}?updated=1`);
}

export async function assignSurveyVersionAction(workspaceSlug: string, formData: FormData) {
  const surveyVersionId = String(formData.get("surveyVersionId") ?? "");
  const accessToken = await getAccessToken();

  if (!accessToken) redirect("/login");
  if (!surveyVersionId) redirect(`/workspaces/${workspaceSlug}?assignmentError=validation`);

  try {
    const workspace = await resolveWorkspaceBySlug(accessToken, workspaceSlug);
    await assignSurveyVersionToWorkspace(accessToken, workspace.id, surveyVersionId);
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) redirect("/access-denied");
    if (error instanceof ApiError && error.status === 409) {
      redirect(`/workspaces/${workspaceSlug}?assignmentError=exists`);
    }
    redirect(`/workspaces/${workspaceSlug}?assignmentError=assign`);
  }

  revalidatePath(`/workspaces/${workspaceSlug}`);
  redirect(`/workspaces/${workspaceSlug}?assignmentAdded=1`);
}

export async function unassignSurveyVersionAction(workspaceSlug: string, formData: FormData) {
  const surveyVersionId = String(formData.get("surveyVersionId") ?? "");
  const accessToken = await getAccessToken();

  if (!accessToken) redirect("/login");
  if (!surveyVersionId) redirect(`/workspaces/${workspaceSlug}?assignmentError=unassign`);

  try {
    const workspace = await resolveWorkspaceBySlug(accessToken, workspaceSlug);
    await unassignSurveyVersionFromWorkspace(accessToken, workspace.id, surveyVersionId);
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) redirect("/access-denied");
    redirect(`/workspaces/${workspaceSlug}?assignmentError=unassign`);
  }

  revalidatePath(`/workspaces/${workspaceSlug}`);
  redirect(`/workspaces/${workspaceSlug}?assignmentRemoved=1`);
}

export async function importWorkspaceRecipientsAction(workspaceSlug: string, formData: FormData) {
  const file = formData.get("recipientFile");
  const hasFile = file instanceof File && file.size > 0;
  if (file instanceof File && file.size > 2 * 1024 * 1024) redirect(`/workspaces/${workspaceSlug}/recipients?error=file-size`);
  const recipients = hasFile
    ? (await file.text()).replace(/^﻿/, "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((row) => {
      const [displayName, email] = row.includes(";") ? row.split(";", 2) : row.includes(",") ? row.split(",", 2) : ["", row];
      return { display_name: displayName.trim() || null, email: email.trim() };
    }).filter((recipient) => recipient.email.toLowerCase() !== "email" && recipient.email.toLowerCase() !== "e-mail")
    : formData.getAll("recipientEmail").map(String).map((email, index) => ({
      display_name: String(formData.getAll("recipientName")[index] ?? "").trim() || null,
      email: email.trim(),
    })).filter((recipient) => recipient.email);
  if (!recipients.length || recipients.length > 2_000) redirect(`/workspaces/${workspaceSlug}/recipients?error=recipients`);

  const accessToken = await getAccessToken();
  if (!accessToken) redirect("/login");
  let createdCount: number;
  let duplicateCount: number;
  try {
    const workspace = await resolveWorkspaceBySlug(accessToken, workspaceSlug);
    const result = await importRecipients(accessToken, workspace.id, recipients);
    createdCount = result.created_count;
    duplicateCount = result.duplicate_count;
  } catch {
    redirect(`/workspaces/${workspaceSlug}/recipients?error=recipients`);
  }
  revalidatePath(`/workspaces/${workspaceSlug}/recipients`);
  redirect(`/workspaces/${workspaceSlug}/recipients?created=${createdCount}&duplicates=${duplicateCount}`);
}

export async function optOutWorkspaceRecipientAction(workspaceSlug: string, recipientId: string) {
  const accessToken = await getAccessToken();
  if (!accessToken) redirect("/login");
  try {
    const workspace = await resolveWorkspaceBySlug(accessToken, workspaceSlug);
    await optOutRecipient(accessToken, workspace.id, recipientId);
  } catch {
    redirect(`/workspaces/${workspaceSlug}/recipients?error=opt-out`);
  }
  revalidatePath(`/workspaces/${workspaceSlug}/recipients`);
  redirect(`/workspaces/${workspaceSlug}/recipients?optedOut=1`);
}
