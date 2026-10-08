import Link from "next/link";
import { useTranslations } from "next-intl";
import {
  Building2Icon,
  ClipboardListIcon,
  MailIcon,
  LayoutDashboardIcon,
  ShieldCheckIcon,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { CurrentUser } from "@/lib/api/types";
import { userDisplayName, userInitials } from "@/lib/user-display";

const navigation = [
  { key: "overview", icon: LayoutDashboardIcon, href: "/" },
  { key: "surveys", icon: ClipboardListIcon, href: "/surveys" },
  { key: "workspaces", icon: Building2Icon, href: "/workspaces" },
  { key: "administration", icon: ShieldCheckIcon, href: "/administration/users" },
  { key: "email", icon: MailIcon, href: "/administration/email" },
] as const;

export function DashboardSidebar({ user }: { user: CurrentUser }) {
  const t = useTranslations("dashboard");
  return (
    <aside className="hidden min-h-screen flex-col border-r border-sidebar-border bg-sidebar px-4 py-5 text-sidebar-foreground lg:flex">
      <Link href="/" className="flex items-center gap-3 px-2">
        <div className="flex size-9 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground shadow-lg shadow-black/15">
          <ClipboardListIcon className="size-5" />
        </div>
        <span className="font-heading text-lg font-semibold tracking-tight">OpenPulse</span>
      </Link>
      <nav aria-label={t("nav.label")} className="mt-10 flex flex-col gap-1">
        {navigation.map(({ key, icon: Icon, href }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground/65 transition-colors hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground"
          >
            <Icon className="size-4" />
            <span>{t(`nav.${key}`)}</span>
          </Link>
        ))}
      </nav>
      <div className="mt-auto flex items-center gap-3 border-t border-sidebar-border pt-5">
        <Avatar>
          <AvatarFallback className="bg-sidebar-primary/20 font-medium text-sidebar-primary-foreground">
            {userInitials(user)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{userDisplayName(user)}</p>
          <p className="truncate text-xs text-sidebar-foreground/55">{t("platformUser")}</p>
        </div>
      </div>
    </aside>
  );
}
