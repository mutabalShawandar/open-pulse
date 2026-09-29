import { headers } from "next/headers";

import { getOrganizationBySlug } from "@/lib/api/client";
import type { Organization } from "@/lib/api/types";
import { getAccessToken } from "@/lib/auth/session";

/**
 * Resolves the organization for the current request from the
 * "x-organization-slug" header proxy.ts sets on every "app.{org-slug}.{root}"
 * request. Returns null on the canonical "app.{root}" host (no org
 * subdomain), so callers fall back to their existing unscoped behavior.
 */
export async function getRequestOrganization(): Promise<Organization | null> {
  const slug = (await headers()).get("x-organization-slug");
  if (!slug) return null;

  const accessToken = await getAccessToken();
  if (!accessToken) return null;

  return getOrganizationBySlug(accessToken, slug);
}
