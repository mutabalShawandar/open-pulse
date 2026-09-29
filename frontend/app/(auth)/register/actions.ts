"use server";

import { redirect } from "next/navigation";

import { ApiError, registerOrganization } from "@/lib/api/client";

export async function registerOrganizationAction(formData: FormData) {
  const organizationName = String(formData.get("organizationName") ?? "").trim();
  const organizationSlug = String(formData.get("organizationSlug") ?? "").trim();
  const ownerDisplayName = String(formData.get("ownerDisplayName") ?? "").trim();
  const ownerEmail = String(formData.get("ownerEmail") ?? "").trim();

  if (!organizationName || !organizationSlug || !ownerDisplayName || !ownerEmail) {
    redirect("/register?error=validation");
  }

  try {
    await registerOrganization({
      organization_name: organizationName,
      organization_slug: organizationSlug,
      owner_display_name: ownerDisplayName,
      owner_email: ownerEmail,
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) redirect("/register?error=slug-taken");
    if (error instanceof ApiError && error.status === 422) redirect("/register?error=validation");
    if (error instanceof ApiError && error.status === 429) redirect("/register?error=rate-limited");
    redirect("/register?error=unknown");
  }

  redirect("/register?registered=1");
}
