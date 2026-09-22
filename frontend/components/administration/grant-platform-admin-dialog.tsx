"use client";

import { ShieldCheckIcon } from "lucide-react";

import { grantPlatformAdminAction } from "@/app/(platform)/administration/users/actions";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export function GrantPlatformAdminDialog({ userId, userName }: { userId: string; userName: string }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="ghost" size="sm" />}><ShieldCheckIcon data-icon="inline-start" /> Vollzugriff</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader><AlertDialogTitle>Vollzugriff erteilen?</AlertDialogTitle><AlertDialogDescription>{userName} erhält Zugriff auf alle Kliniken, Kampagnen, Umfragen und die Benutzerverwaltung.</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel>Abbrechen</AlertDialogCancel><form action={grantPlatformAdminAction}><input type="hidden" name="userId" value={userId} /><AlertDialogAction type="submit">Vollzugriff erteilen</AlertDialogAction></form></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
