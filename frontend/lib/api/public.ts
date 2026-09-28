export type PublicQuestionType =
  | "single_choice"
  | "multiple_choice"
  | "yes_no"
  | "rating"
  | "short_text"
  | "long_text"
  | "number"
  | "date";

export type PublicCampaign = {
  title: string;
  description: string | null;
  clinic_name: string;
  logo_url: string | null;
  branding: { accent_color?: string } | null;
  sections: Array<{
    id: string;
    title: string;
    description: string | null;
    questions: Array<{
      id: string;
      question_type: PublicQuestionType;
      title: string;
      help_text: string | null;
      is_required: boolean;
      allow_other: boolean;
      options: Array<{ id: string; label: string; value: string }>;
      validations: Record<string, { value: string | number }>;
    }>;
  }>;
};

function publicApiBaseUrl(): string {
  // Runs server-side (Server Component). INTERNAL_API_BASE_URL lets the
  // container reach the backend over the Docker network (e.g. "http://backend:8000")
  // when it differs from the browser-facing NEXT_PUBLIC_API_BASE_URL.
  const value = process.env.INTERNAL_API_BASE_URL || process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!value) throw new Error("NEXT_PUBLIC_API_BASE_URL is not configured");
  return value.replace(/\/$/, "");
}

export async function getPublicCampaign(slug: string): Promise<PublicCampaign | null> {
  const response = await fetch(`${publicApiBaseUrl()}/api/v1/public/campaigns/${encodeURIComponent(slug)}`, { cache: "no-store" });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Public campaign could not be loaded");
  return response.json() as Promise<PublicCampaign>;
}
