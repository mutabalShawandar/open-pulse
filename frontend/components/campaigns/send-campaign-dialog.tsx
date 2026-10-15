"use client";

import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
import { SendIcon } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

export function SendCampaignDialog({ campaignTitle, recipientCount, subject, action }: { campaignTitle: string; recipientCount: number; subject: string; action: (formData: FormData) => void | Promise<void> }) {
  const t = useTranslations("campaigns.sendDialog");
  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button disabled={!subject || recipientCount === 0} />}>
        <SendIcon data-icon="inline-start" />
        {t("trigger")}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia><SendIcon /></AlertDialogMedia>
          <AlertDialogTitle>{t("title")}</AlertDialogTitle>
          <AlertDialogDescription>
            <span className="block">{t("campaign", { title: campaignTitle })}</span>
            <span className="mt-2 block">{t("summary", { count: recipientCount, subject })}</span>
            <span className="mt-3 block font-medium text-foreground">{t("warning")}</span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
          <form action={action}>
            <StartSendingButton />
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function StartSendingButton() {
  const t = useTranslations("campaigns.sendDialog");
  const { pending } = useFormStatus();

  return (
    <AlertDialogAction type="submit" disabled={pending} aria-busy={pending}>
      {pending ? <Spinner data-icon="inline-start" /> : <SendIcon data-icon="inline-start" />}
      {pending ? t("starting") : t("submit")}
    </AlertDialogAction>
  );
}
