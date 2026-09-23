"use client";

import { useFormStatus } from "react-dom";
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
  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button disabled={!subject || recipientCount === 0} />}>
        <SendIcon data-icon="inline-start" />
        Kampagne jetzt versenden
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia><SendIcon /></AlertDialogMedia>
          <AlertDialogTitle>E-Mails jetzt versenden?</AlertDialogTitle>
          <AlertDialogDescription>
            <span className="block">Kampagne: „{campaignTitle}“</span>
            <span className="mt-2 block">Empfänger: {recipientCount} · Betreff: {subject}</span>
            <span className="mt-3 block font-medium text-foreground">Der Versand startet sofort im Hintergrund. Die Vorlage wird dabei gesperrt und bereits versandte E-Mails können nicht zurückgerufen werden.</span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
          <form action={action}>
            <StartSendingButton />
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function StartSendingButton() {
  const { pending } = useFormStatus();

  return (
    <AlertDialogAction type="submit" disabled={pending} aria-busy={pending}>
      {pending ? <Spinner data-icon="inline-start" /> : <SendIcon data-icon="inline-start" />}
      {pending ? "Versand wird gestartet …" : "Jetzt versenden"}
    </AlertDialogAction>
  );
}
