"use client";

import { UserXIcon } from "lucide-react";

import { deactivateUserAction } from "@/app/(platform)/administration/users/actions";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogMedia, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

type DeactivateUserDialogProps = { userId: string; userName: string };

export function DeactivateUserDialog({ userId, userName }: DeactivateUserDialogProps) {
  return <AlertDialog><AlertDialogTrigger render={<Button variant="ghost" size="sm" />}>Deaktivieren</AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogMedia><UserXIcon /></AlertDialogMedia><AlertDialogTitle>Benutzer deaktivieren?</AlertDialogTitle><AlertDialogDescription>{userName} kann sich danach nicht mehr in der Plattform anmelden. Diese Aktion deaktiviert auch das zugehörige Keycloak-Konto.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Abbrechen</AlertDialogCancel><form action={deactivateUserAction}><input type="hidden" name="userId" value={userId} /><AlertDialogAction type="submit" variant="destructive">Deaktivieren</AlertDialogAction></form></AlertDialogFooter></AlertDialogContent></AlertDialog>;
}
