import Link from "next/link";
import { ArrowLeftIcon, UsersRoundIcon } from "lucide-react";

import { OptOutRecipientDialog } from "@/components/clinics/opt-out-recipient-dialog";
import { RecipientImportForm } from "@/components/campaigns/recipient-import-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { importClinicRecipientsAction, optOutClinicRecipientAction } from "../../actions";
import { listRecipients } from "@/lib/api/client";
import { getAccessToken } from "@/lib/auth/session";
import { resolveClinicBySlug } from "@/lib/resolve-clinic";

export default async function ClinicRecipientsPage({ params, searchParams }: { params: Promise<{ clinicId: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { clinicId: clinicSlug } = await params;
  const query = await searchParams;
  const token = await getAccessToken();
  if (!token) return null;
  const clinic = await resolveClinicBySlug(token, clinicSlug);
  const recipients = await listRecipients(token, clinic.id);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-7 sm:px-6 lg:px-10 lg:py-10">
      <div>
        <Button nativeButton={false} variant="ghost" render={<Link href={`/clinics/${clinicSlug}`} />}><ArrowLeftIcon data-icon="inline-start" /> Zur Klinik</Button>
        <div className="mt-4 flex items-start gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-secondary text-secondary-foreground"><UsersRoundIcon className="size-5" /></div>
          <div><p className="text-sm font-medium text-muted-foreground">{clinic.name}</p><h1 className="font-heading text-3xl font-semibold tracking-tight">Empfängerverzeichnis</h1></div>
        </div>
      </div>

      {query.created ? <div className="rounded-md border border-primary/30 bg-primary/5 px-4 py-3 text-sm">Import abgeschlossen: {query.created} neu, {query.duplicates ?? 0} bereits vorhanden.</div> : null}
      {query.optedOut ? <div className="rounded-md border border-primary/30 bg-primary/5 px-4 py-3 text-sm">Der Empfänger wurde für weitere E-Mails abgemeldet.</div> : null}
      {query.error ? <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">Die Änderung konnte nicht gespeichert werden. Prüfen Sie die Eingaben und versuchen Sie es erneut.</div> : null}

      <Card>
        <CardHeader><CardTitle>Empfänger hinzufügen</CardTitle><CardDescription>Einzelne Patienten/Kontakte werden über Formularfelder erfasst. Für größere Listen verwenden Sie die CSV-Datei.</CardDescription></CardHeader>
        <CardContent><RecipientImportForm action={importClinicRecipientsAction.bind(null, clinicSlug)} submitLabel="Empfänger speichern" /></CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Gespeicherte Empfänger ({recipients.length})</CardTitle><CardDescription>Nur aktive Empfänger können später einer E-Mail-Kampagne zugeordnet werden.</CardDescription></CardHeader>
        <CardContent className="flex flex-col gap-2">
          {recipients.length ? recipients.map((recipient) => (
            <div key={recipient.id} className="flex flex-col gap-2 rounded-lg border px-3 py-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{recipient.display_name || "Ohne Namen"}</p><p className="truncate text-sm text-muted-foreground">{recipient.email}</p></div>
              <Badge variant={recipient.status === "active" ? "secondary" : "outline"}>{recipient.status === "active" ? "Aktiv" : recipient.status === "opted_out" ? "Abgemeldet" : "Unzustellbar"}</Badge>
              {recipient.status === "active" ? <OptOutRecipientDialog recipientName={recipient.display_name || recipient.email} action={optOutClinicRecipientAction.bind(null, clinicSlug, recipient.id)} /> : null}
            </div>
          )) : <p className="py-6 text-sm text-muted-foreground">Noch keine Empfänger für diese Klinik gespeichert.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
