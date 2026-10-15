"use client";

import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("admin.email.form");
  return (
    <div className="flex flex-col gap-8">
      <form action={saveSmtpConfigurationAction}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="senderName">{t("senderName")}</FieldLabel>
            <Input id="senderName" name="senderName" required defaultValue={configuration?.sender_name ?? "OpenPulse"} />
          </Field>
          <Field>
            <FieldLabel htmlFor="senderEmail">{t("senderEmail")}</FieldLabel>
            <Input id="senderEmail" name="senderEmail" type="email" required defaultValue={configuration?.sender_email ?? ""} />
          </Field>
          <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_9rem]">
            <Field>
              <FieldLabel htmlFor="host">{t("host")}</FieldLabel>
              <Input id="host" name="host" required placeholder="smtp.example.com" defaultValue={configuration?.host ?? ""} />
            </Field>
            <Field>
              <FieldLabel htmlFor="port">{t("port")}</FieldLabel>
              <Input id="port" name="port" type="number" min="1" max="65535" required defaultValue={configuration?.port ?? 587} />
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="transport">{t("encryption")}</FieldLabel>
            <NativeSelect id="transport" name="transport" defaultValue={configuration?.use_ssl ? "ssl" : configuration?.use_starttls === false ? "none" : "starttls"}>
              <NativeSelectOption value="starttls">{t("starttls")}</NativeSelectOption>
              <NativeSelectOption value="ssl">{t("ssl")}</NativeSelectOption>
              <NativeSelectOption value="none">{t("none")}</NativeSelectOption>
            </NativeSelect>
          </Field>
          <Field>
            <FieldLabel htmlFor="username">{t("username")} <span className="font-normal text-muted-foreground">{t("optional")}</span></FieldLabel>
            <Input id="username" name="username" autoComplete="username" defaultValue={configuration?.username ?? ""} />
          </Field>
          <Field>
            <FieldLabel htmlFor="password">{t("password")} {configuration?.password_configured ? <Badge variant="secondary">{t("stored")}</Badge> : null}</FieldLabel>
            <Input id="password" name="password" type="password" autoComplete="new-password" placeholder={configuration?.password_configured ? t("keepPassword") : t("passwordPlaceholder")} />
            <FieldDescription>{t("passwordHint")}</FieldDescription>
          </Field>
          <SaveButton />
        </FieldGroup>
      </form>
      {configuration ? <form action={sendSmtpTestEmailAction} className="border-t pt-6"><FieldGroup><Field><FieldLabel htmlFor="recipientEmail">{t("testTo")}</FieldLabel><Input id="recipientEmail" name="recipientEmail" type="email" required placeholder="admin@example.com" /><FieldDescription>{t("testHint")}</FieldDescription></Field><TestButton /></FieldGroup></form> : null}
    </div>
  );
}

function SaveButton() {
  const t = useTranslations("admin.email.form");
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending}>{pending ? <Spinner data-icon="inline-start" /> : <SaveIcon data-icon="inline-start" />}{pending ? t("saving") : t("save")}</Button>;
}

function TestButton() {
  const t = useTranslations("admin.email.form");
  const { pending } = useFormStatus();
  return <Button type="submit" variant="outline" disabled={pending}>{pending ? <Spinner data-icon="inline-start" /> : <SendIcon data-icon="inline-start" />}{pending ? t("sending") : t("sendTest")}</Button>;
}
