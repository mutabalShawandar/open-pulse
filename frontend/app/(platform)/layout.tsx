import type { ReactNode } from "react";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { requireUser } from "@/lib/auth/require-user";
import { getRequestOrganization } from "@/lib/auth/request-organization";

export default async function PlatformLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const organization = await getRequestOrganization();
  return (
    <DashboardShell user={user} organization={organization}>
      {children}
    </DashboardShell>
  );
}
