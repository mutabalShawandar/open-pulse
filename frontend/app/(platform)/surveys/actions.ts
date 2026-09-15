"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { ApiError, archiveSurvey, copySurvey, createSurvey, restoreSurvey, updateSurvey } from "@/lib/api/client";
import { getAccessToken } from "@/lib/auth/session";

function text(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

async function token() {
  const accessToken = await getAccessToken();
  if (!accessToken) redirect("/login");
  return accessToken;
}

export async function createSurveyAction(formData: FormData) {
  const title = text(formData, "title");
  if (!title) redirect("/surveys/new?error=validation");
  try {
    const survey = await createSurvey(await token(), { title, description: text(formData, "description") || null, initial_draft_label: text(formData, "draftLabel") || null });
    revalidatePath("/surveys");
    redirect(`/surveys/${survey.id}?created=1`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) redirect("/access-denied");
    redirect("/surveys/new?error=create");
  }
}

export async function updateSurveyAction(surveyId: string, formData: FormData) {
  const title = text(formData, "title");
  if (!title) redirect(`/surveys/${surveyId}?error=validation`);
  try {
    await updateSurvey(await token(), surveyId, { title, description: text(formData, "description") || null });
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) redirect("/access-denied");
    redirect(`/surveys/${surveyId}?error=update`);
  }
  revalidatePath("/surveys"); revalidatePath(`/surveys/${surveyId}`); redirect(`/surveys/${surveyId}?updated=1`);
}

export async function archiveSurveyAction(surveyId: string) {
  try { await archiveSurvey(await token(), surveyId); } catch { redirect(`/surveys/${surveyId}?error=archive`); }
  revalidatePath("/surveys"); redirect("/surveys?archived=1");
}

export async function restoreSurveyAction(surveyId: string) {
  try { await restoreSurvey(await token(), surveyId); } catch { redirect(`/surveys/${surveyId}?error=restore`); }
  revalidatePath("/surveys"); redirect("/surveys?restored=1");
}

export async function copySurveyAction(surveyId: string, formData: FormData) {
  const sourceVersionId = text(formData, "sourceVersionId");
  if (!sourceVersionId) redirect(`/surveys/${surveyId}?error=copy`);
  try {
    const survey = await copySurvey(await token(), surveyId, { source_version_id: sourceVersionId, title: text(formData, "copyTitle") || null, description: text(formData, "copyDescription") || null });
    revalidatePath("/surveys");
    redirect(`/surveys/${survey.id}?copied=1`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) redirect("/access-denied");
    redirect(`/surveys/${surveyId}?error=copy`);
  }
}
