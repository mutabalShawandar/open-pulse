"use client";

import { useTranslations } from "next-intl";
import { UserXIcon } from "lucide-react";

import { deactivateUserAction } from "@/app/(platform)/administration/users/actions";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogMedia, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

type DeactivateUserDialogProps = { userId: string; userName: string };

export function DeactivateUserDialog({ userId, userName }: DeactivateUserDialogProps) {
  const t = useTranslations("admin.users.deactivate");
  return <AlertDialog><AlertDialogTrigger render={<Button variant="ghost" size="sm" />}>{t("trigger")}</AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogMedia><UserXIcon /></AlertDialogMedia><AlertDialogTitle>{t("title")}</AlertDialogTitle><AlertDialogDescription>{t("description", { name: userName })}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>{t("cancel")}</AlertDialogCancel><form action={deactivateUserAction}><input type="hidden" name="userId" value={userId} /><AlertDialogAction type="submit" variant="destructive">{t("confirm")}</AlertDialogAction></form></AlertDialogFooter></AlertDialogContent></AlertDialog>;
}
