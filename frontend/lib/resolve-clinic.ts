import { notFound } from "next/navigation";
import { listClinics } from "@/lib/api/client";
import type { Clinic } from "@/lib/api/types";

/**
 * Clinic URLs use the slug (e.g. /clinics/demo-klinik), but every backend
 * endpoint is keyed by the clinic's UUID. This resolves the slug from the
 * route once per page/action so callers can use the real id for API calls.
 */
export async function resolveClinicBySlug(token: string, slug: string): Promise<Clinic> {
  const clinics = await listClinics(token);
  const clinic = clinics.find((item) => item.slug === slug);
  if (!clinic) notFound();
  return clinic;
}
