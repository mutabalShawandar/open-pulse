"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  ApiError,
  createSurveySection,
  createSurveyQuestion,
  createSurveyQuestionOption,
  createSurveyQuestionValidation,
  deleteSurveySection,
  deleteSurveyQuestion,
  deleteSurveyQuestionOption,
  deleteSurveyQuestionValidation,
  publishSurveyDraft,
  reorderSurveyQuestionOptions,
  reorderSurveyQuestions,
  reorderSurveySections,
  updateSurveySection,
  updateSurveyQuestion,
  updateSurveyQuestionOption,
  updateSurveyQuestionValidation,
} from "@/lib/api/client";
import { getAccessToken } from "@/lib/auth/session";

function value(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

async function token() {
  const accessToken = await getAccessToken();
  if (!accessToken) redirect("/login");
  return accessToken;
}

function draftPath(surveyId: string, draftId: string) {
  return `/surveys/${surveyId}/drafts/${draftId}`;
}

function finish(surveyId: string, draftId: string, notice?: string): never {
  revalidatePath(`/surveys/${surveyId}`);
  revalidatePath(draftPath(surveyId, draftId));
  redirect(`${draftPath(surveyId, draftId)}${notice ? `?${notice}=1` : ""}`);
}

export async function createSectionAction(surveyId: string, draftId: string, formData: FormData) {
  const title = value(formData, "title");
  if (!title) redirect(`${draftPath(surveyId, draftId)}?error=section-title`);
  try {
    await createSurveySection(await token(), surveyId, draftId, {
      title,
      description: value(formData, "description") || null,
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) redirect("/access-denied");
    redirect(`${draftPath(surveyId, draftId)}?error=create-section`);
  }
  finish(surveyId, draftId, "section-created");
}

export async function updateSectionAction(
  surveyId: string,
  draftId: string,
  sectionId: string,
  formData: FormData,
) {
  const title = value(formData, "title");
  if (!title) redirect(`${draftPath(surveyId, draftId)}?error=section-title`);
  try {
    await updateSurveySection(await token(), surveyId, draftId, sectionId, {
      title,
      description: value(formData, "description") || null,
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) redirect("/access-denied");
    redirect(`${draftPath(surveyId, draftId)}?error=update-section`);
  }
  finish(surveyId, draftId, "section-updated");
}

export async function deleteSectionAction(surveyId: string, draftId: string, sectionId: string) {
  try {
    await deleteSurveySection(await token(), surveyId, draftId, sectionId);
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) redirect("/access-denied");
    redirect(`${draftPath(surveyId, draftId)}?error=delete-section`);
  }
  finish(surveyId, draftId, "section-deleted");
}

export async function moveSectionAction(surveyId: string, draftId: string, formData: FormData) {
  const ids = value(formData, "sectionIds").split(",").filter(Boolean);
  const sectionId = value(formData, "sectionId");
  const direction = value(formData, "direction");
  const index = ids.indexOf(sectionId);
  const target = direction === "up" ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= ids.length) finish(surveyId, draftId);
  [ids[index], ids[target]] = [ids[target], ids[index]];
  try {
    await reorderSurveySections(await token(), surveyId, draftId, ids);
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) redirect("/access-denied");
    redirect(`${draftPath(surveyId, draftId)}?error=move-section`);
  }
  finish(surveyId, draftId, "section-moved");
}

export async function createQuestionAction(
  surveyId: string,
  draftId: string,
  sectionId: string,
  formData: FormData,
) {
  const title = value(formData, "title");
  const questionType = value(formData, "questionType");
  if (!title || !questionType) redirect(`${draftPath(surveyId, draftId)}?error=question-validation`);
  const initialOptions = formData
    .getAll("initialOption")
    .map((option) => String(option).trim())
    .filter(Boolean);
  if (
    (questionType === "single_choice" || questionType === "multiple_choice")
    && (initialOptions.length < 2 || new Set(initialOptions).size !== initialOptions.length)
  ) {
    redirect(`${draftPath(surveyId, draftId)}?error=option-validation`);
  }
  try {
    const accessToken = await token();
    const question = await createSurveyQuestion(accessToken, surveyId, draftId, sectionId, {
      question_type: questionType as Parameters<typeof createSurveyQuestion>[4]["question_type"],
      title,
      help_text: value(formData, "helpText") || null,
      is_required: formData.get("isRequired") === "on",
      allow_other: formData.get("allowOther") === "on",
    });
    for (const option of initialOptions) {
      await createSurveyQuestionOption(accessToken, surveyId, draftId, sectionId, question.id, option);
    }
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) redirect("/access-denied");
    redirect(`${draftPath(surveyId, draftId)}?error=create-question`);
  }
  finish(surveyId, draftId, "question-created");
}

export async function updateQuestionAction(
  surveyId: string,
  draftId: string,
  sectionId: string,
  questionId: string,
  formData: FormData,
) {
  const title = value(formData, "title");
  if (!title) redirect(`${draftPath(surveyId, draftId)}?error=question-validation`);
  try {
    await updateSurveyQuestion(await token(), surveyId, draftId, sectionId, questionId, {
      title,
      help_text: value(formData, "helpText") || null,
      is_required: formData.get("isRequired") === "on",
      allow_other: formData.get("allowOther") === "on",
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) redirect("/access-denied");
    redirect(`${draftPath(surveyId, draftId)}?error=update-question`);
  }
  finish(surveyId, draftId, "question-updated");
}

export async function deleteQuestionAction(
  surveyId: string,
  draftId: string,
  sectionId: string,
  questionId: string,
) {
  try {
    await deleteSurveyQuestion(await token(), surveyId, draftId, sectionId, questionId);
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) redirect("/access-denied");
    redirect(`${draftPath(surveyId, draftId)}?error=delete-question`);
  }
  finish(surveyId, draftId, "question-deleted");
}

export async function createOptionAction(surveyId: string, draftId: string, sectionId: string, questionId: string, formData: FormData) {
  const label = value(formData, "optionLabel");
  if (!label) redirect(`${draftPath(surveyId, draftId)}?error=option-validation`);
  try { await createSurveyQuestionOption(await token(), surveyId, draftId, sectionId, questionId, label); }
  catch { redirect(`${draftPath(surveyId, draftId)}?error=create-option`); }
  finish(surveyId, draftId, "option-created");
}

export async function deleteOptionAction(surveyId: string, draftId: string, sectionId: string, questionId: string, optionId: string) {
  try { await deleteSurveyQuestionOption(await token(), surveyId, draftId, sectionId, questionId, optionId); }
  catch { redirect(`${draftPath(surveyId, draftId)}?error=delete-option`); }
  finish(surveyId, draftId, "option-deleted");
}

export async function moveQuestionAction(surveyId: string, draftId: string, sectionId: string, formData: FormData) {
  const ids = value(formData, "questionIds").split(",").filter(Boolean);
  const questionId = value(formData, "questionId");
  const index = ids.indexOf(questionId);
  const target = value(formData, "direction") === "up" ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= ids.length) finish(surveyId, draftId);
  [ids[index], ids[target]] = [ids[target], ids[index]];
  try { await reorderSurveyQuestions(await token(), surveyId, draftId, sectionId, ids); }
  catch { redirect(`${draftPath(surveyId, draftId)}?error=move-question`); }
  finish(surveyId, draftId, "question-moved");
}

export async function updateOptionAction(surveyId: string, draftId: string, sectionId: string, questionId: string, optionId: string, formData: FormData) {
  const label = value(formData, "optionLabel");
  const optionValue = value(formData, "optionValue");
  if (!label || !optionValue) redirect(`${draftPath(surveyId, draftId)}?error=option-validation`);
  try { await updateSurveyQuestionOption(await token(), surveyId, draftId, sectionId, questionId, optionId, { label, value: optionValue }); }
  catch { redirect(`${draftPath(surveyId, draftId)}?error=update-option`); }
  finish(surveyId, draftId, "option-updated");
}

export async function moveOptionAction(surveyId: string, draftId: string, sectionId: string, questionId: string, formData: FormData) {
  const ids = value(formData, "optionIds").split(",").filter(Boolean);
  const optionId = value(formData, "optionId");
  const index = ids.indexOf(optionId);
  const target = value(formData, "direction") === "up" ? index - 1 : index + 1;
  if (index < 0 || target < 0 || target >= ids.length) finish(surveyId, draftId);
  [ids[index], ids[target]] = [ids[target], ids[index]];
  try { await reorderSurveyQuestionOptions(await token(), surveyId, draftId, sectionId, questionId, ids); }
  catch { redirect(`${draftPath(surveyId, draftId)}?error=move-option`); }
  finish(surveyId, draftId, "option-moved");
}

function validationValue(formData: FormData, ruleType: string): string | number {
  const raw = value(formData, "ruleValue");
  return ruleType === "min_date" || ruleType === "max_date" ? raw : Number(raw);
}

export async function createValidationAction(surveyId: string, draftId: string, sectionId: string, questionId: string, formData: FormData) {
  const ruleType = value(formData, "ruleType");
  const ruleValue = validationValue(formData, ruleType);
  if (!ruleType || (typeof ruleValue === "number" && !Number.isFinite(ruleValue))) redirect(`${draftPath(surveyId, draftId)}?error=validation-rule`);
  try { await createSurveyQuestionValidation(await token(), surveyId, draftId, sectionId, questionId, { rule_type: ruleType, rule_value: { value: ruleValue } }); }
  catch { redirect(`${draftPath(surveyId, draftId)}?error=create-validation`); }
  finish(surveyId, draftId, "validation-created");
}

export async function updateValidationAction(surveyId: string, draftId: string, sectionId: string, questionId: string, validationId: string, ruleType: string, formData: FormData) {
  const ruleValue = validationValue(formData, ruleType);
  if (typeof ruleValue === "number" && !Number.isFinite(ruleValue)) redirect(`${draftPath(surveyId, draftId)}?error=validation-rule`);
  try { await updateSurveyQuestionValidation(await token(), surveyId, draftId, sectionId, questionId, validationId, { rule_value: { value: ruleValue } }); }
  catch { redirect(`${draftPath(surveyId, draftId)}?error=update-validation`); }
  finish(surveyId, draftId, "validation-updated");
}

export async function deleteValidationAction(surveyId: string, draftId: string, sectionId: string, questionId: string, validationId: string) {
  try { await deleteSurveyQuestionValidation(await token(), surveyId, draftId, sectionId, questionId, validationId); }
  catch { redirect(`${draftPath(surveyId, draftId)}?error=delete-validation`); }
  finish(surveyId, draftId, "validation-deleted");
}

export async function publishDraftAction(surveyId: string, draftId: string) {
  try {
    const version = await publishSurveyDraft(await token(), surveyId, draftId);
    revalidatePath(`/surveys/${surveyId}`);
    redirect(`/surveys/${surveyId}/versions/${version.version_number}?published=1`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) redirect("/access-denied");
    redirect(`${draftPath(surveyId, draftId)}?error=publish`);
  }
}
