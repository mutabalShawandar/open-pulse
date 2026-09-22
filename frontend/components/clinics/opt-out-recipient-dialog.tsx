"use client";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export function OptOutRecipientDialog({ recipientName, action }: { recipientName: string; action: () => void | Promise<void> }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button size="sm" variant="destructive" />}>Abmelden</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Empfänger abmelden?</AlertDialogTitle>
          <AlertDialogDescription>{recipientName} erhält keine weiteren Kampagnen-E-Mails dieser Klinik. Diese Aktion kann derzeit nicht über die Oberfläche rückgängig gemacht werden.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
          <form action={action}><AlertDialogAction type="submit" variant="destructive">Abmeldung bestätigen</AlertDialogAction></form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
