"use client";

import { useTranslations } from "next-intl";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export function OptOutRecipientDialog({ recipientName, action }: { recipientName: string; action: () => void | Promise<void> }) {
  const t = useTranslations("recipients.optOut");
  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button size="sm" variant="destructive" />}>{t("trigger")}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("title")}</AlertDialogTitle>
          <AlertDialogDescription>{t("description", { name: recipientName })}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
          <form action={action}><AlertDialogAction type="submit" variant="destructive">{t("confirm")}</AlertDialogAction></form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
