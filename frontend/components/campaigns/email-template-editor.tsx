"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { defaultEmailHtmlBody, defaultEmailSubject, defaultEmailTextBody, EmailTemplateFields } from "@/components/campaigns/email-template-fields";
import type { CampaignEmailTemplate } from "@/lib/api/types";

export function EmailTemplateEditor({ campaignTitle, template, saveAction, testAction }: { campaignTitle: string; template: CampaignEmailTemplate | null; saveAction: (formData: FormData) => void | Promise<void>; testAction: (formData: FormData) => void | Promise<void> }) {
  const t = useTranslations("campaigns.emailEditor");
  const locked = Boolean(template?.locked_at);
  const [values, setValues] = useState({
    subject: template?.subject ?? defaultEmailSubject,
    htmlBody: template?.html_body ?? defaultEmailHtmlBody,
    textBody: template?.text_body ?? defaultEmailTextBody,
    senderName: template?.sender_name ?? "",
    replyTo: template?.reply_to ?? "",
  });

  return (
    <div className="flex flex-col gap-6">
      {locked ? <p className="rounded-md border border-primary/30 bg-primary/5 px-4 py-3 text-sm">{t("locked")}</p> : null}
      <form action={saveAction}>
        <EmailTemplateFields
          campaignTitle={campaignTitle}
          values={values}
          onChange={(next) => setValues((current) => ({ ...current, ...next }))}
          fieldNames={{ subject: "subject", htmlBody: "htmlBody", textBody: "textBody", senderName: "senderName", replyTo: "replyTo" }}
          readOnly={locked}
        />
        <Button type="submit" className="mt-5" disabled={locked}>{t("save")}</Button>
      </form>
      <form action={testAction} className="flex flex-wrap items-end gap-3 border-t pt-5">
        <Field className="flex-1"><FieldLabel htmlFor="recipientEmail">{t("testRecipient")}</FieldLabel><Input id="recipientEmail" name="recipientEmail" required type="email" placeholder={t("testPlaceholder")} /></Field>
        <Button type="submit" variant="outline">{t("sendTest")}</Button>
      </form>
    </div>
  );
}
