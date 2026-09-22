"use client";

import { Trash2Icon } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogMedia, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export function DeleteCampaignDialog({ campaignId, campaignTitle, deleteAction, disabled }: { campaignId: string; campaignTitle: string; deleteAction: (campaignId: string) => Promise<void>; disabled?: boolean }) {
  return <AlertDialog><AlertDialogTrigger render={<Button variant="destructive" disabled={disabled} />}><Trash2Icon data-icon="inline-start" />Kampagne löschen</AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogMedia><Trash2Icon /></AlertDialogMedia><AlertDialogTitle>Kampagne löschen?</AlertDialogTitle><AlertDialogDescription>„{campaignTitle}“ wird dauerhaft gelöscht. Dies ist nur möglich, solange noch keine Antworten gestartet wurden.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Abbrechen</AlertDialogCancel><form action={deleteAction.bind(null, campaignId)}><AlertDialogAction type="submit" variant="destructive">Endgültig löschen</AlertDialogAction></form></AlertDialogFooter></AlertDialogContent></AlertDialog>;
}
