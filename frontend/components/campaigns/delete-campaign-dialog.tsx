"use client";

import { useTranslations } from "next-intl";
import { Trash2Icon } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogMedia, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export function DeleteCampaignDialog({ campaignId, campaignTitle, deleteAction, disabled }: { campaignId: string; campaignTitle: string; deleteAction: (campaignId: string) => Promise<void>; disabled?: boolean }) {
  const t = useTranslations("campaigns.deleteDialog");
  return <AlertDialog><AlertDialogTrigger render={<Button variant="destructive" disabled={disabled} />}><Trash2Icon data-icon="inline-start" />{t("trigger")}</AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogMedia><Trash2Icon /></AlertDialogMedia><AlertDialogTitle>{t("title")}</AlertDialogTitle><AlertDialogDescription>{t("description", { title: campaignTitle })}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>{t("cancel")}</AlertDialogCancel><form action={deleteAction.bind(null, campaignId)}><AlertDialogAction type="submit" variant="destructive">{t("confirm")}</AlertDialogAction></form></AlertDialogFooter></AlertDialogContent></AlertDialog>;
}
