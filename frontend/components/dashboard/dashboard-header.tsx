import { getTranslations } from "next-intl/server";
import { ChevronDownIcon, ClipboardListIcon } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { LanguageSwitcher } from "@/components/platform/language-switcher";
import { HelpGuide } from "@/components/dashboard/help-guide";
import type { CurrentUser, Organization } from "@/lib/api/types";
import { userDisplayName, userInitials } from "@/lib/user-display";

export async function DashboardHeader({ user, organization }: { user: CurrentUser; organization: Organization | null }) {
  const t = await getTranslations("dashboard");
  return (
    <header className="flex min-h-16 items-center justify-between gap-4 border-b bg-background px-4 sm:px-6 lg:px-10">
      <div className="flex items-center gap-3"><div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground lg:hidden"><ClipboardListIcon className="size-4" /></div><span className="text-sm text-muted-foreground">{organization ? organization.name : t("workspaceFallback")}</span></div>
      <div className="flex items-center gap-2">
        <LanguageSwitcher />
        <HelpGuide />
        <DropdownMenu><DropdownMenuTrigger render={<Button variant="ghost" className="flex" />}><Avatar size="sm"><AvatarFallback>{userInitials(user)}</AvatarFallback></Avatar><span>{userDisplayName(user)}</span><ChevronDownIcon data-icon="inline-end" /></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-52"><DropdownMenuGroup><DropdownMenuLabel>{t("myAccount")}</DropdownMenuLabel></DropdownMenuGroup><DropdownMenuSeparator /><DropdownMenuGroup><form action="/auth/logout" method="post"><Button type="submit" variant="ghost" className="w-full justify-start">{t("logout")}</Button></form></DropdownMenuGroup></DropdownMenuContent></DropdownMenu>
      </div>
    </header>
  );
}
