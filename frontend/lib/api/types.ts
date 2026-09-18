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
  logo_url: string | null;
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
