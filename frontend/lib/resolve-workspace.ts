import { notFound } from "next/navigation";
import { listWorkspaces } from "@/lib/api/client";
import type { Workspace } from "@/lib/api/types";

/**
 * Workspace URLs use the slug (e.g. /workspaces/demo-klinik), but every backend
 * endpoint is keyed by the workspace's UUID. This resolves the slug from the
 * route once per page/action so callers can use the real id for API calls.
 */
export async function resolveWorkspaceBySlug(token: string, slug: string): Promise<Workspace> {
  const workspaces = await listWorkspaces(token);
  const workspace = workspaces.find((item) => item.slug === slug);
  if (!workspace) notFound();
  return workspace;
}
