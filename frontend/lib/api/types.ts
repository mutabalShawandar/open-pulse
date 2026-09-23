export type CurrentUser = {
  id: string;
  email: string;
  display_name: string | null;
  is_active: boolean;
};

export type PlatformUser = CurrentUser;

export type Clinic = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  street: string | null;
  hausnummer: number | null;
  city: string | null;
  postal_code: string | null;
};

export type ClinicDetail = Clinic & {
  created_at: string;
  updated_at: string;
};

export type ClinicInput = {
  name: string;
  slug: string;
  logo_url?: string | null;
  street: string | null;
  hausnummer: number | null;
  city: string | null;
  postal_code: string | null;
};

export type ClinicMember = {
  user_id: string;
  clinic_id: string;
  role_id: string;
  user_email: string | null;
  user_display_name: string | null;
  role_name: string | null;
};

export type Role = {
  id: string;
  name: string;
  description: string | null;
};

export type Survey = {
  id: string;
  title: string;
  description: string | null;
  status: "draft" | "published" | "archived";
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type SurveyDraft = {
  id: string;
  status: "draft";
  draft_label: string | null;
  based_on_version_id: string | null;
  created_at: string;
  updated_at: string;
};

export type SurveyDetail = Survey & {
  created_by_user_id: string | null;
  drafts: SurveyDraft[];
};

export type SurveySection = {
  id: string;
  survey_version_id: string;
  title: string;
  description: string | null;
  position: number;
  created_at: string;
  updated_at: string;
};

export type SurveyQuestionType =
  | "single_choice"
  | "multiple_choice"
  | "yes_no"
  | "rating"
  | "short_text"
  | "long_text"
  | "number"
  | "date";

export type SurveyQuestion = {
  id: string;
  section_id: string;
  question_type: SurveyQuestionType;
  title: string;
  help_text: string | null;
  is_required: boolean;
  allow_other: boolean;
  position: number;
  created_at: string;
  updated_at: string;
};

export type SurveyQuestionDetail = SurveyQuestion & {
  options: SurveyQuestionOption[];
  validations: SurveyQuestionValidation[];
};

export type SurveyQuestionOption = {
  id: string;
  question_id: string;
  label: string;
  value: string;
  position: number;
};

export type SurveyQuestionValidation = {
  id: string;
  question_id: string;
  rule_type: string;
  rule_value: Record<string, string | number>;
};

export type SurveySectionDetail = SurveySection & {
  questions: SurveyQuestionDetail[];
};

export type SurveyDraftDetail = SurveyDraft & {
  survey_id: string;
  sections: SurveySectionDetail[];
};

export type PublishedSurveyVersionDetail = SurveyVersion & {
  sections: SurveySectionDetail[];
};

export type SurveyVersion = {
  id: string;
  survey_id: string;
  version_number: number | null;
  status: "draft" | "published" | "archived";
  draft_label: string | null;
  based_on_version_id: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ClinicSurveyVersionAssignment = {
  id: string;
  survey_version_id: string;
  clinic_id: string;
  assigned_by_user_id: string | null;
  assigned_at: string;
  unassigned_at: string | null;
};

export type PublishedSurveyVersionOption = {
  id: string;
  label: string;
};

export type Campaign = {
  id: string;
  clinic_id: string;
  survey_version_id: string;
  survey_title: string;
  survey_version_number: number;
  title: string;
  description: string | null;
  public_slug: string;
  public_path: string | null;
  status: "draft" | "scheduled" | "active" | "paused" | "completed" | "cancelled";
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CampaignAnalytics = {
  campaign_id: string;
  campaign_title: string;
  started_count: number;
  completed_count: number;
  questions: Array<{ question_id: string; title: string; question_type: string; answer_count: number; average: number | null; median: number | null; minimum: number | null; maximum: number | null; choices: Array<{ label: string; count: number }>; distribution: Array<{ label: string; count: number }>; text_answers: string[]; earliest_date: string | null; latest_date: string | null }>;
};

export type SmtpConfiguration = {
  id: string;
  host: string;
  port: number;
  use_starttls: boolean;
  use_ssl: boolean;
  username: string | null;
  password_configured: boolean;
  sender_name: string;
  sender_email: string;
  created_at: string;
  updated_at: string;
};

export type Recipient = {
  id: string;
  clinic_id: string;
  display_name: string | null;
  email: string;
  status: "active" | "opted_out" | "bounced";
  source: string;
  opted_out_at: string | null;
  created_at: string;
  updated_at: string;
};

export type RecipientImportResult = {
  created_count: number;
  duplicate_count: number;
  recipients: Recipient[];
};

export type CampaignRecipient = {
  id: string;
  campaign_id: string;
  recipient_id: string;
  display_name: string | null;
  email: string;
  recipient_status: Recipient["status"];
  status: "pending" | "queued" | "sent" | "failed" | "bounced" | "completed";
  sent_at: string | null;
  last_error: string | null;
  created_at: string;
};

export type CampaignEmailTemplate = { campaign_id: string; subject: string; html_body: string; text_body: string; sender_name: string | null; reply_to: string | null; locked_at: string | null };

export type CampaignDelivery = {
  id: string;
  recipient_id: string;
  display_name: string | null;
  email: string;
  status: "queued" | "sending" | "sent" | "failed";
  attempt_count: number;
  queued_at: string | null;
  sent_at: string | null;
  last_error: string | null;
};

export type CampaignDeliveryQueueResult = { queued_count: number; skipped_count: number };
