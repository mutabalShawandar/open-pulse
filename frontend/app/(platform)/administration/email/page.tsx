import { MailCheckIcon } from "lucide-react";

import { SmtpConfigurationForm } from "@/components/administration/smtp-configuration-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError, getSmtpConfiguration } from "@/lib/api/client";
import { requireUser } from "@/lib/auth/require-user";
import { getAccessToken } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import type { SmtpConfiguration } from "@/lib/api/types";

export default async function EmailAdministrationPage({ searchParams }: PageProps<"/administration/email">) {
  await requireUser();
  const accessToken = await getAccessToken();
  if (!accessToken) return null;
  let configuration: SmtpConfiguration | null = null;
  let availabilityMessage: string | null = null;
  try {
    configuration = await getSmtpConfiguration(accessToken);
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) redirect("/access-denied");
    if (error instanceof ApiError && error.status === 404) {
      availabilityMessage = "Die SMTP-Funktion ist im verbundenen Backend noch nicht verfügbar. Starten Sie das Backend mit der aktuellen Version neu und führen Sie die Datenbankmigration aus.";
    } else {
      availabilityMessage = "Die SMTP-Konfiguration kann momentan nicht geladen werden. Bitte versuchen Sie es später erneut.";
    }
  }
  const query = await searchParams;
  const errorMessage = query.error ? "Die Aktion konnte nicht abgeschlossen werden. Pr\u00fcfen Sie Server, Zugangsdaten und den Verschl\u00fcsselungs-Schl\u00fcssel." : null;

  return <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-7 sm:px-6 lg:px-10 lg:py-10">
    <section><p className="text-sm font-medium text-muted-foreground">Administration</p><h1 className="mt-2 font-heading text-3xl font-semibold tracking-tight">E-Mail-Versand</h1><p className="mt-2 text-muted-foreground">Globale SMTP-Verbindung f\u00fcr Kampagnen-E-Mails einrichten.</p></section>
    {query.saved ? <Alert><MailCheckIcon /><AlertTitle>SMTP-Konfiguration gespeichert</AlertTitle><AlertDescription>Sie k\u00f6nnen jetzt eine Test-E-Mail versenden.</AlertDescription></Alert> : null}
    {query.tested ? <Alert><MailCheckIcon /><AlertTitle>Test-E-Mail an SMTP-Server \u00fcbergeben</AlertTitle><AlertDescription>Pr\u00fcfen Sie das Postfach des Empf\u00e4ngers.</AlertDescription></Alert> : null}
    {errorMessage ? <Alert variant="destructive"><AlertTitle>Aktion fehlgeschlagen</AlertTitle><AlertDescription>{errorMessage}</AlertDescription></Alert> : null}
    {availabilityMessage ? <Alert variant="destructive"><AlertTitle>SMTP-Konfiguration nicht verfügbar</AlertTitle><AlertDescription>{availabilityMessage}</AlertDescription></Alert> : <Card><CardHeader><CardTitle>SMTP-Verbindung</CardTitle><CardDescription>Nur Plattformadministratoren k\u00f6nnen diese Zugangsdaten verwalten. Kampagnenversand wird erst im n\u00e4chsten Schritt aktiviert.</CardDescription></CardHeader><CardContent><SmtpConfigurationForm configuration={configuration} /></CardContent></Card>}
  </div>;
}
