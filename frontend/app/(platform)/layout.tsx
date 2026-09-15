import type { ReactNode } from "react";

import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { requireUser } from "@/lib/auth/require-user";

export default async function PlatformLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  return <DashboardShell user={user}>{children}</DashboardShell>;
}
