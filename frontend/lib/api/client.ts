import { authConfig } from "@/lib/auth/config";
import type {
  Clinic,
  ClinicDetail,
  ClinicInput,
  ClinicMember,
  ClinicSurveyVersionAssignment,
  CurrentUser,
  Organization,
  OrganizationRegisterInput,
  PlatformUser,
  Survey,
  SurveyDetail,
  SurveyDraft,
  SurveyDraftDetail,
  SurveyQuestion,
  SurveyQuestionOption,
  SurveyQuestionValidation,
  SurveyQuestionType,
  SurveySection,
  SurveyVersion,
  PublishedSurveyVersionDetail,
  Role,
  Campaign,
  CampaignAnalytics,
  SmtpConfiguration,
  Recipient,
  RecipientImportResult,
  CampaignRecipient,
  CampaignEmailTemplate,
  CampaignDelivery,
  CampaignDeliveryQueueResult,
} from "@/lib/api/types";

export class ApiError extends Error {
  constructor(public readonly status: number, public readonly detail?: string) {
    super(detail ?? `API request failed with status ${status}`);
  }
}

async function readErrorDetail(response: Response): Promise<string | undefined> {
  try {
    const body = await response.json();
    if (typeof body?.detail === "string") return body.detail;
  } catch {
    // response body wasn't JSON; fall back to the generic status message
  }
  return undefined;
}

async function apiFetch<T>(path: string, accessToken: string): Promise<T> {
  const response = await fetch(`${authConfig.apiBaseUrl}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!response.ok) throw new ApiError(response.status, await readErrorDetail(response));
  return response.json() as Promise<T>;
}

export function getCurrentUser(accessToken: string): Promise<CurrentUser> {
  return apiFetch<CurrentUser>("/api/v1/me", accessToken);
}

export function listPlatformUsers(accessToken: string): Promise<PlatformUser[]> {
  return apiFetch<PlatformUser[]>("/api/v1/users", accessToken);
}

export async function registerOrganization(payload: OrganizationRegisterInput): Promise<Organization> {
  const response = await fetch(`${authConfig.apiBaseUrl}/api/v1/organizations/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  if (!response.ok) throw new ApiError(response.status, await readErrorDetail(response));
  return response.json() as Promise<Organization>;
}

export async function checkOrganizationSlugAvailable(slug: string): Promise<boolean> {
  const response = await fetch(`${authConfig.apiBaseUrl}/api/v1/organizations/slug-available/${encodeURIComponent(slug)}`, {
    cache: "no-store",
  });
  if (!response.ok) throw new ApiError(response.status, await readErrorDetail(response));
  const body = (await response.json()) as { available: boolean };
  return body.available;
}

export function getSmtpConfiguration(accessToken: string): Promise<SmtpConfiguration | null> {
  return apiFetch<SmtpConfiguration | null>("/api/v1/administration/smtp", accessToken);
}

export async function saveSmtpConfiguration(
  accessToken: string,
  payload: {
    host: string;
    port: number;
    use_starttls: boolean;
    use_ssl: boolean;
    username: string | null;
    password: string | null;
    sender_name: string;
    sender_email: string;
  },
): Promise<SmtpConfiguration> {
  const response = await fetch(`${authConfig.apiBaseUrl}/api/v1/administration/smtp`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  if (!response.ok) throw new ApiError(response.status);
  return response.json() as Promise<SmtpConfiguration>;
}

export async function sendSmtpTestEmail(accessToken: string, recipientEmail: string): Promise<void> {
  const response = await fetch(`${authConfig.apiBaseUrl}/api/v1/administration/smtp/test`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ recipient_email: recipientEmail }),
    cache: "no-store",
  });
  if (!response.ok) throw new ApiError(response.status);
}

export function listClinics(accessToken: string): Promise<Clinic[]> {
  return apiFetch<Clinic[]>("/api/v1/clinics", accessToken);
}

export function listCampaigns(accessToken: string): Promise<Campaign[]> {
  return apiFetch<Campaign[]>("/api/v1/campaigns", accessToken);
}

export function getCampaign(accessToken: string, campaignId: string): Promise<Campaign> {
  return apiFetch<Campaign>(`/api/v1/campaigns/${campaignId}`, accessToken);
}

export function getCampaignEmailTemplate(accessToken: string, campaignId: string): Promise<CampaignEmailTemplate | null> { return apiFetch<CampaignEmailTemplate | null>(`/api/v1/campaigns/${campaignId}/email-template`, accessToken); }

export function saveCampaignEmailTemplate(accessToken: string, campaignId: string, payload: Omit<CampaignEmailTemplate, "campaign_id" | "locked_at">): Promise<CampaignEmailTemplate> { return writeSurvey(accessToken, `/api/v1/campaigns/${campaignId}/email-template`, "PUT", payload); }

export function testCampaignEmailTemplate(accessToken: string, campaignId: string, recipientEmail: string): Promise<void> {
  return writeSurvey(accessToken, `/api/v1/campaigns/${campaignId}/email-template/test`, "POST", { recipient_email: recipientEmail });
}

export function listCampaignDeliveries(accessToken: string, campaignId: string): Promise<CampaignDelivery[]> {
  return apiFetch<CampaignDelivery[]>(`/api/v1/campaigns/${campaignId}/deliveries`, accessToken);
}

export function queueCampaignDeliveries(accessToken: string, campaignId: string): Promise<CampaignDeliveryQueueResult> {
  return writeSurvey(accessToken, `/api/v1/campaigns/${campaignId}/send`, "POST");
}

export function retryFailedCampaignDeliveries(accessToken: string, campaignId: string): Promise<CampaignDeliveryQueueResult> {
  return writeSurvey(accessToken, `/api/v1/campaigns/${campaignId}/deliveries/retry-failed`, "POST");
}

export function listRecipients(accessToken: string, clinicId: string): Promise<Recipient[]> {
  return apiFetch<Recipient[]>(`/api/v1/clinics/${clinicId}/recipients`, accessToken);
}

export function listCampaignRecipients(accessToken: string, campaignId: string): Promise<CampaignRecipient[]> {
  return apiFetch<CampaignRecipient[]>(`/api/v1/campaigns/${campaignId}/recipients`, accessToken);
}

export function importRecipients(accessToken: string, clinicId: string, recipients: Array<{ email: string; display_name: string | null }>): Promise<RecipientImportResult> {
  return writeSurvey(accessToken, `/api/v1/clinics/${clinicId}/recipients/import`, "POST", { recipients });
}

export function optOutRecipient(accessToken: string, clinicId: string, recipientId: string): Promise<Recipient> {
  return writeSurvey(accessToken, `/api/v1/clinics/${clinicId}/recipients/${recipientId}/opt-out`, "POST");
}

export function assignCampaignRecipients(accessToken: string, campaignId: string, recipientIds: string[]): Promise<CampaignRecipient[]> {
  return writeSurvey(accessToken, `/api/v1/campaigns/${campaignId}/recipients`, "POST", { recipient_ids: recipientIds });
}

export function removeCampaignRecipient(accessToken: string, campaignId: string, recipientId: string): Promise<void> {
  return deleteSurveyResource(accessToken, `/api/v1/campaigns/${campaignId}/recipients/${recipientId}`);
}

export function getCampaignAnalytics(accessToken: string, clinicId: string, campaignId: string): Promise<CampaignAnalytics> {
  return apiFetch<CampaignAnalytics>(`/api/v1/clinics/${clinicId}/analytics/campaigns/${campaignId}`, accessToken);
}

export function createCampaign(accessToken: string, payload: { clinic_id: string; survey_version_id: string; title: string; description: string | null; ends_at?: string | null }): Promise<Campaign> {
  return writeSurvey(accessToken, "/api/v1/campaigns", "POST", payload);
}

export function updateCampaign(accessToken: string, campaignId: string, payload: { status?: Campaign["status"]; survey_version_id?: string; ends_at?: string | null }): Promise<Campaign> {
  return writeSurvey(accessToken, `/api/v1/campaigns/${campaignId}`, "PATCH", payload);
}

export async function deleteCampaign(accessToken: string, campaignId: string): Promise<void> {
  const response = await fetch(`${authConfig.apiBaseUrl}/api/v1/campaigns/${campaignId}`, { method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" });
  if (!response.ok) throw new ApiError(response.status);
}

export function getClinic(accessToken: string, clinicId: string): Promise<ClinicDetail> {
  return apiFetch<ClinicDetail>(`/api/v1/clinics/${clinicId}`, accessToken);
}

export function listClinicMembers(accessToken: string, clinicId: string): Promise<ClinicMember[]> {
  return apiFetch<ClinicMember[]>(`/api/v1/clinics/${clinicId}/members`, accessToken);
}

export function listRoles(accessToken: string): Promise<Role[]> {
  return apiFetch<Role[]>("/api/v1/roles", accessToken);
}

export function listSurveys(accessToken: string, includeArchived = false): Promise<Survey[]> {
  return apiFetch<Survey[]>(`/api/v1/surveys${includeArchived ? "?include_archived=true" : ""}`, accessToken);
}

export function getSurvey(accessToken: string, surveyId: string): Promise<SurveyDetail> {
  return apiFetch<SurveyDetail>(`/api/v1/surveys/${surveyId}`, accessToken);
}

export function getSurveyDraft(
  accessToken: string,
  surveyId: string,
  draftId: string,
): Promise<SurveyDraftDetail> {
  return apiFetch<SurveyDraftDetail>(
    `/api/v1/surveys/${surveyId}/drafts/${draftId}`,
    accessToken,
  );
}

async function writeSurvey<T>(accessToken: string, path: string, method: "POST" | "PATCH" | "PUT", payload?: unknown): Promise<T> {
  const response = await fetch(`${authConfig.apiBaseUrl}${path}`, {
    method,
    headers: { Authorization: `Bearer ${accessToken}`, ...(payload ? { "Content-Type": "application/json" } : {}) },
    body: payload ? JSON.stringify(payload) : undefined,
    cache: "no-store",
  });
  if (!response.ok) throw new ApiError(response.status, await readErrorDetail(response));
  return response.json() as Promise<T>;
}

async function deleteSurveyResource(accessToken: string, path: string): Promise<void> {
  const response = await fetch(`${authConfig.apiBaseUrl}${path}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!response.ok) throw new ApiError(response.status, await readErrorDetail(response));
}

export function createSurveySection(
  accessToken: string,
  surveyId: string,
  draftId: string,
  payload: { title: string; description: string | null },
): Promise<SurveySection> {
  return writeSurvey(
    accessToken,
    `/api/v1/surveys/${surveyId}/drafts/${draftId}/sections`,
    "POST",
    payload,
  );
}

export function updateSurveySection(
  accessToken: string,
  surveyId: string,
  draftId: string,
  sectionId: string,
  payload: { title: string; description: string | null },
): Promise<SurveySection> {
  return writeSurvey(
    accessToken,
    `/api/v1/surveys/${surveyId}/drafts/${draftId}/sections/${sectionId}`,
    "PATCH",
    payload,
  );
}

export function deleteSurveySection(
  accessToken: string,
  surveyId: string,
  draftId: string,
  sectionId: string,
): Promise<void> {
  return deleteSurveyResource(
    accessToken,
    `/api/v1/surveys/${surveyId}/drafts/${draftId}/sections/${sectionId}`,
  );
}

export function reorderSurveySections(
  accessToken: string,
  surveyId: string,
  draftId: string,
  sectionIds: string[],
): Promise<SurveySection[]> {
  return writeSurvey(
    accessToken,
    `/api/v1/surveys/${surveyId}/drafts/${draftId}/sections/reorder`,
    "POST",
    { section_ids: sectionIds },
  );
}

export function createSurveyQuestion(
  accessToken: string,
  surveyId: string,
  draftId: string,
  sectionId: string,
  payload: { question_type: SurveyQuestionType; title: string; help_text: string | null; is_required: boolean; allow_other: boolean },
): Promise<SurveyQuestion> {
  return writeSurvey(
    accessToken,
    `/api/v1/surveys/${surveyId}/drafts/${draftId}/sections/${sectionId}/questions`,
    "POST",
    payload,
  );
}

export function updateSurveyQuestion(
  accessToken: string,
  surveyId: string,
  draftId: string,
  sectionId: string,
  questionId: string,
  payload: { title: string; help_text: string | null; is_required: boolean; allow_other: boolean },
): Promise<SurveyQuestion> {
  return writeSurvey(
    accessToken,
    `/api/v1/surveys/${surveyId}/drafts/${draftId}/sections/${sectionId}/questions/${questionId}`,
    "PATCH",
    payload,
  );
}

export function deleteSurveyQuestion(
  accessToken: string,
  surveyId: string,
  draftId: string,
  sectionId: string,
  questionId: string,
): Promise<void> {
  return deleteSurveyResource(
    accessToken,
    `/api/v1/surveys/${surveyId}/drafts/${draftId}/sections/${sectionId}/questions/${questionId}`,
  );
}

export function reorderSurveyQuestions(
  accessToken: string, surveyId: string, draftId: string, sectionId: string, questionIds: string[],
): Promise<SurveyQuestion[]> {
  return writeSurvey(accessToken, `/api/v1/surveys/${surveyId}/drafts/${draftId}/sections/${sectionId}/questions/reorder`, "POST", { question_ids: questionIds });
}

export function createSurveyQuestionOption(
  accessToken: string, surveyId: string, draftId: string, sectionId: string, questionId: string, label: string,
): Promise<{ id: string }> {
  return writeSurvey(accessToken, `/api/v1/surveys/${surveyId}/drafts/${draftId}/sections/${sectionId}/questions/${questionId}/options`, "POST", { label, value: label });
}

export function deleteSurveyQuestionOption(
  accessToken: string, surveyId: string, draftId: string, sectionId: string, questionId: string, optionId: string,
): Promise<void> {
  return deleteSurveyResource(accessToken, `/api/v1/surveys/${surveyId}/drafts/${draftId}/sections/${sectionId}/questions/${questionId}/options/${optionId}`);
}

export function updateSurveyQuestionOption(
  accessToken: string, surveyId: string, draftId: string, sectionId: string, questionId: string, optionId: string,
  payload: { label: string; value: string },
): Promise<SurveyQuestionOption> {
  return writeSurvey(accessToken, `/api/v1/surveys/${surveyId}/drafts/${draftId}/sections/${sectionId}/questions/${questionId}/options/${optionId}`, "PATCH", payload);
}

export function reorderSurveyQuestionOptions(
  accessToken: string, surveyId: string, draftId: string, sectionId: string, questionId: string, optionIds: string[],
): Promise<SurveyQuestionOption[]> {
  return writeSurvey(accessToken, `/api/v1/surveys/${surveyId}/drafts/${draftId}/sections/${sectionId}/questions/${questionId}/options/reorder`, "POST", { option_ids: optionIds });
}

export function createSurveyQuestionValidation(
  accessToken: string, surveyId: string, draftId: string, sectionId: string, questionId: string,
  payload: { rule_type: string; rule_value: { value: string | number } },
): Promise<SurveyQuestionValidation> {
  return writeSurvey(accessToken, `/api/v1/surveys/${surveyId}/drafts/${draftId}/sections/${sectionId}/questions/${questionId}/validations`, "POST", payload);
}

export function updateSurveyQuestionValidation(
  accessToken: string, surveyId: string, draftId: string, sectionId: string, questionId: string, validationId: string,
  payload: { rule_value: { value: string | number } },
): Promise<SurveyQuestionValidation> {
  return writeSurvey(accessToken, `/api/v1/surveys/${surveyId}/drafts/${draftId}/sections/${sectionId}/questions/${questionId}/validations/${validationId}`, "PATCH", payload);
}

export function deleteSurveyQuestionValidation(
  accessToken: string, surveyId: string, draftId: string, sectionId: string, questionId: string, validationId: string,
): Promise<void> {
  return deleteSurveyResource(accessToken, `/api/v1/surveys/${surveyId}/drafts/${draftId}/sections/${sectionId}/questions/${questionId}/validations/${validationId}`);
}

export function createSurvey(accessToken: string, payload: { title: string; description: string | null; initial_draft_label: string | null }): Promise<SurveyDetail> {
  return writeSurvey(accessToken, "/api/v1/surveys", "POST", payload);
}

export function createSurveyDraft(
  accessToken: string,
  surveyId: string,
  payload: { draft_label: string | null; source_version_id: string | null },
): Promise<SurveyDraft> {
  return writeSurvey(accessToken, `/api/v1/surveys/${surveyId}/drafts`, "POST", payload);
}

export function updateSurvey(accessToken: string, surveyId: string, payload: { title: string; description: string | null }): Promise<Survey> {
  return writeSurvey(accessToken, `/api/v1/surveys/${surveyId}`, "PATCH", payload);
}

export function archiveSurvey(accessToken: string, surveyId: string): Promise<Survey> {
  return writeSurvey(accessToken, `/api/v1/surveys/${surveyId}/archive`, "POST");
}

export function restoreSurvey(accessToken: string, surveyId: string): Promise<Survey> {
  return writeSurvey(accessToken, `/api/v1/surveys/${surveyId}/restore`, "POST");
}

export function copySurvey(accessToken: string, surveyId: string, payload: { source_version_id: string; title: string | null; description: string | null }): Promise<SurveyDetail> {
  return writeSurvey(accessToken, `/api/v1/surveys/${surveyId}/copy`, "POST", payload);
}

export function listPublishedSurveyVersions(
  accessToken: string,
  surveyId: string,
): Promise<SurveyVersion[]> {
  return apiFetch<SurveyVersion[]>(`/api/v1/surveys/${surveyId}/versions`, accessToken);
}

export function getPublishedSurveyVersion(
  accessToken: string, surveyId: string, versionNumber: number,
): Promise<PublishedSurveyVersionDetail> {
  return apiFetch<PublishedSurveyVersionDetail>(`/api/v1/surveys/${surveyId}/versions/${versionNumber}`, accessToken);
}

export function publishSurveyDraft(
  accessToken: string, surveyId: string, draftId: string,
): Promise<SurveyVersion> {
  return writeSurvey(accessToken, `/api/v1/surveys/${surveyId}/drafts/${draftId}/publish`, "POST");
}

export function listClinicSurveyVersionAssignments(
  accessToken: string,
  clinicId: string,
): Promise<ClinicSurveyVersionAssignment[]> {
  return apiFetch<ClinicSurveyVersionAssignment[]>(
    `/api/v1/clinics/${clinicId}/survey-versions`,
    accessToken,
  );
}

async function mutateSurveyVersionAssignment(
  accessToken: string,
  clinicId: string,
  surveyVersionId: string,
  action: "assign" | "unassign",
): Promise<void> {
  const response = await fetch(
    `${authConfig.apiBaseUrl}/api/v1/clinics/${clinicId}/survey-versions/${surveyVersionId}/${action}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    },
  );
  if (!response.ok) throw new ApiError(response.status);
}

export function assignSurveyVersionToClinic(
  accessToken: string,
  clinicId: string,
  surveyVersionId: string,
): Promise<void> {
  return mutateSurveyVersionAssignment(accessToken, clinicId, surveyVersionId, "assign");
}

export function unassignSurveyVersionFromClinic(
  accessToken: string,
  clinicId: string,
  surveyVersionId: string,
): Promise<void> {
  return mutateSurveyVersionAssignment(accessToken, clinicId, surveyVersionId, "unassign");
}

async function writeMembership(
  accessToken: string,
  path: string,
  method: "POST" | "DELETE",
  payload?: { user_id: string; role_id: string },
): Promise<void> {
  const response = await fetch(`${authConfig.apiBaseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(payload ? { "Content-Type": "application/json" } : {}),
    },
    body: payload ? JSON.stringify(payload) : undefined,
    cache: "no-store",
  });
  if (!response.ok) throw new ApiError(response.status);
}

export function addClinicMember(
  accessToken: string,
  clinicId: string,
  payload: { user_id: string; role_id: string },
): Promise<void> {
  return writeMembership(accessToken, `/api/v1/clinics/${clinicId}/members`, "POST", payload);
}

export function removeClinicMember(
  accessToken: string,
  clinicId: string,
  userId: string,
): Promise<void> {
  return writeMembership(accessToken, `/api/v1/clinics/${clinicId}/members/${userId}`, "DELETE");
}

async function writeClinic(
  accessToken: string,
  path: string,
  method: "POST" | "PATCH",
  payload: ClinicInput,
): Promise<Clinic> {
  const response = await fetch(`${authConfig.apiBaseUrl}${path}`, {
    method,
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  if (!response.ok) throw new ApiError(response.status);
  return response.json() as Promise<Clinic>;
}

export function createClinic(accessToken: string, payload: ClinicInput): Promise<Clinic> {
  return writeClinic(accessToken, "/api/v1/clinics", "POST", payload);
}

export function updateClinic(
  accessToken: string,
  clinicId: string,
  payload: ClinicInput,
): Promise<Clinic> {
  return writeClinic(accessToken, `/api/v1/clinics/${clinicId}`, "PATCH", payload);
}

export async function uploadClinicLogo(accessToken: string, clinicId: string, logo: File): Promise<Clinic> {
  const body = new FormData();
  body.append("logo", logo);
  const response = await fetch(`${authConfig.apiBaseUrl}/api/v1/clinics/${clinicId}/logo`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body,
    cache: "no-store",
  });
  if (!response.ok) throw new ApiError(response.status, await readErrorDetail(response));
  return response.json() as Promise<Clinic>;
}

export async function createPlatformUser(
  accessToken: string,
  payload: Pick<PlatformUser, "email" | "display_name">,
): Promise<PlatformUser> {
  const response = await fetch(`${authConfig.apiBaseUrl}/api/v1/users`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  if (!response.ok) throw new ApiError(response.status);
  return response.json() as Promise<PlatformUser>;
}

export async function deactivatePlatformUser(
  accessToken: string,
  userId: string,
): Promise<PlatformUser> {
  const response = await fetch(`${authConfig.apiBaseUrl}/api/v1/users/${userId}/deactivate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!response.ok) throw new ApiError(response.status);
  return response.json() as Promise<PlatformUser>;
}

export async function reactivatePlatformUser(
  accessToken: string,
  userId: string,
): Promise<PlatformUser> {
  const response = await fetch(
    `${authConfig.apiBaseUrl}/api/v1/users/${userId}/reactivate`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    },
  );
  if (!response.ok) throw new ApiError(response.status);
  return response.json() as Promise<PlatformUser>;
}

export async function permanentlyDeletePlatformUser(
  accessToken: string,
  userId: string,
): Promise<void> {
  const response = await fetch(`${authConfig.apiBaseUrl}/api/v1/users/${userId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!response.ok) throw new ApiError(response.status);
}

export async function grantPlatformAdmin(accessToken: string, userId: string): Promise<void> {
  const response = await fetch(`${authConfig.apiBaseUrl}/api/v1/users/${userId}/roles/platform-admin`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!response.ok) throw new ApiError(response.status);
}
