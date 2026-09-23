import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { NavigationLoadingIndicator } from "@/components/dashboard/navigation-loading-indicator";
import { DashboardSidebar } from "@/components/dashboard/dashboard-sidebar";
import type { CurrentUser } from "@/lib/api/types";
import type { ReactNode } from "react";

export function DashboardShell({ children, user }: { children: ReactNode; user: CurrentUser }) {
  return (
    <div className="min-h-screen bg-background lg:grid lg:grid-cols-[17rem_minmax(0,1fr)]">
      <DashboardSidebar user={user} />
      <main className="min-w-0"><DashboardHeader user={user} />{children}</main>
      <NavigationLoadingIndicator />
    </div>
  );
}
