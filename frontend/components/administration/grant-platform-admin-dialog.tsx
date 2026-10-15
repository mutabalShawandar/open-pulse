"use client";

import { useTranslations } from "next-intl";
import { ShieldCheckIcon } from "lucide-react";

import { grantPlatformAdminAction } from "@/app/(platform)/administration/users/actions";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export function GrantPlatformAdminDialog({ userId, userName }: { userId: string; userName: string }) {
  const t = useTranslations("admin.users.grantAdmin");
  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="ghost" size="sm" />}><ShieldCheckIcon data-icon="inline-start" /> {t("trigger")}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>{t("title")}</AlertDialogTitle><AlertDialogDescription>{t("description", { name: userName })}</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>{t("cancel")}</AlertDialogCancel><form action={grantPlatformAdminAction}><input type="hidden" name="userId" value={userId} /><AlertDialogAction type="submit">{t("confirm")}</AlertDialogAction></form></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
