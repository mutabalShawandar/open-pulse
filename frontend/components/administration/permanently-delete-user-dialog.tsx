"use client";

import { useTranslations } from "next-intl";
import { Trash2Icon } from "lucide-react";

import { permanentlyDeleteUserAction } from "@/app/(platform)/administration/users/actions";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogMedia, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

type PermanentlyDeleteUserDialogProps = { userId: string; userName: string };

export function PermanentlyDeleteUserDialog({ userId, userName }: PermanentlyDeleteUserDialogProps) {
  const t = useTranslations("admin.users.delete");
  return <AlertDialog><AlertDialogTrigger render={<Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" />}>{t("trigger")}</AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogMedia><Trash2Icon /></AlertDialogMedia><AlertDialogTitle>{t("title")}</AlertDialogTitle><AlertDialogDescription>{t("description", { name: userName })}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>{t("cancel")}</AlertDialogCancel><form action={permanentlyDeleteUserAction}><input type="hidden" name="userId" value={userId} /><AlertDialogAction type="submit" variant="destructive">{t("confirm")}</AlertDialogAction></form></AlertDialogFooter></AlertDialogContent></AlertDialog>;
}
