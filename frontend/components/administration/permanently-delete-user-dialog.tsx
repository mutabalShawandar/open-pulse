"use client";

import { Trash2Icon } from "lucide-react";

import { permanentlyDeleteUserAction } from "@/app/(platform)/administration/users/actions";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogMedia, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

type PermanentlyDeleteUserDialogProps = { userId: string; userName: string };

export function PermanentlyDeleteUserDialog({ userId, userName }: PermanentlyDeleteUserDialogProps) {
  return <AlertDialog><AlertDialogTrigger render={<Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" />}>Löschen</AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogMedia><Trash2Icon /></AlertDialogMedia><AlertDialogTitle>Benutzer endgültig löschen?</AlertDialogTitle><AlertDialogDescription>{userName} wird aus Keycloak und der Plattform gelöscht. Klinische Zuordnungen und Rollen werden entfernt. Die Aktion kann nicht rückgängig gemacht werden.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Abbrechen</AlertDialogCancel><form action={permanentlyDeleteUserAction}><input type="hidden" name="userId" value={userId} /><AlertDialogAction type="submit" variant="destructive">Endgültig löschen</AlertDialogAction></form></AlertDialogFooter></AlertDialogContent></AlertDialog>;
}
