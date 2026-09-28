"use client";

import { useFormStatus } from "react-dom";
import { SaveIcon, SendIcon } from "lucide-react";

import {
  saveSmtpConfigurationAction,
  sendSmtpTestEmailAction,
} from "@/app/(platform)/administration/email/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import type { SmtpConfiguration } from "@/lib/api/types";

export function SmtpConfigurationForm({ configuration }: { configuration: SmtpConfiguration | null }) {
  return (
    <div className="flex flex-col gap-8">
      <form action={saveSmtpConfigurationAction}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="senderName">Absendername</FieldLabel>
            <Input id="senderName" name="senderName" required defaultValue={configuration?.sender_name ?? "OpenPulse"} />
          </Field>
          <Field>
            <FieldLabel htmlFor="senderEmail">Absender-E-Mail-Adresse</FieldLabel>
            <Input id="senderEmail" name="senderEmail" type="email" required defaultValue={configuration?.sender_email ?? ""} />
          </Field>
          <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_9rem]">
            <Field>
              <FieldLabel htmlFor="host">SMTP-Server</FieldLabel>
              <Input id="host" name="host" required placeholder="smtp.example.de" defaultValue={configuration?.host ?? ""} />
            </Field>
            <Field>
              <FieldLabel htmlFor="port">Port</FieldLabel>
              <Input id="port" name="port" type="number" min="1" max="65535" required defaultValue={configuration?.port ?? 587} />
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="transport">Verschl\u00fcsselung</FieldLabel>
            <NativeSelect id="transport" name="transport" defaultValue={configuration?.use_ssl ? "ssl" : configuration?.use_starttls === false ? "none" : "starttls"}>
              <NativeSelectOption value="starttls">STARTTLS (empfohlen, meist Port 587)</NativeSelectOption>
              <NativeSelectOption value="ssl">SSL/TLS (meist Port 465)</NativeSelectOption>
              <NativeSelectOption value="none">Keine Verschl\u00fcsselung (nur lokaler Testserver)</NativeSelectOption>
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel htmlFor="username">Benutzername <span className="font-normal text-muted-foreground">(optional)</span></FieldLabel>
            <Input id="username" name="username" autoComplete="username" defaultValue={configuration?.username ?? ""} />
          </Field>
          <Field>
            <FieldLabel htmlFor="password">Passwort {configuration?.password_configured ? <Badge variant="secondary">gespeichert</Badge> : null}</FieldLabel>
            <Input id="password" name="password" type="password" autoComplete="new-password" placeholder={configuration?.password_configured ? "Leer lassen, um es beizubehalten" : "SMTP-Passwort"} />
            <FieldDescription>Das Passwort wird verschl\u00fcsselt gespeichert und nie wieder angezeigt.</FieldDescription>
          </Field>
          <SaveButton />
        </FieldGroup>
      </form>
      {configuration ? <form action={sendSmtpTestEmailAction} className="border-t pt-6"><FieldGroup><Field><FieldLabel htmlFor="recipientEmail">Test-E-Mail an</FieldLabel><Input id="recipientEmail" name="recipientEmail" type="email" required placeholder="admin@example.de" /><FieldDescription>Der Versand wird im Audit-Protokoll vermerkt. Die E-Mail enth\u00e4lt keine Umfragedaten.</FieldDescription></Field><TestButton /></FieldGroup></form> : null}
    </div>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending}>{pending ? <Spinner data-icon="inline-start" /> : <SaveIcon data-icon="inline-start" />}{pending ? "Wird gespeichert \u2026" : "SMTP-Konfiguration speichern"}</Button>;
}

function TestButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" variant="outline" disabled={pending}>{pending ? <Spinner data-icon="inline-start" /> : <SendIcon data-icon="inline-start" />}{pending ? "Wird gesendet \u2026" : "Test-E-Mail senden"}</Button>;
}
