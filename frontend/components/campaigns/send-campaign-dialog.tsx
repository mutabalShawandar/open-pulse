"use client";

import { SendIcon } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogMedia, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export function SendCampaignDialog({ campaignTitle, recipientCount, subject, action }: { campaignTitle: string; recipientCount: number; subject: string; action: (formData: FormData) => void | Promise<void> }) {
  return <AlertDialog><AlertDialogTrigger render={<Button disabled={!subject || recipientCount === 0} />}><SendIcon data-icon="inline-start" />Kampagne jetzt versenden</AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogMedia><SendIcon /></AlertDialogMedia><AlertDialogTitle>E-Mails jetzt versenden?</AlertDialogTitle><AlertDialogDescription><span className="block">Kampagne: „{campaignTitle}“</span><span className="mt-2 block">Empfänger: {recipientCount} · Betreff: {subject}</span><span className="mt-3 block font-medium text-foreground">Der Versand startet sofort im Hintergrund — es ist keine weitere Aktion nötig. Die Vorlage wird dabei gesperrt und bereits versandte E-Mails können nicht zurückgerufen werden.</span></AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Abbrechen</AlertDialogCancel><form action={action}><AlertDialogAction type="submit">Jetzt versenden</AlertDialogAction></form></AlertDialogFooter></AlertDialogContent></AlertDialog>;
}
