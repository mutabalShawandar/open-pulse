"use client";

import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const emailTemplateVariables = ["{{recipient_name}}", "{{survey_link}}", "{{clinic_name}}", "{{campaign_title}}"];

export const defaultEmailSubject = "Ihre Umfrage: {{campaign_title}}";
export const defaultEmailHtmlBody = "<p>Guten Tag {{recipient_name}},</p><p>bitte nehmen Sie an unserer Umfrage teil:</p><p><a href=\"{{survey_link}}\">Zur Umfrage</a></p><p>Vielen Dank,<br>{{clinic_name}}</p>";
export const defaultEmailTextBody = "Guten Tag {{recipient_name}},\n\nbitte nehmen Sie an unserer Umfrage teil: {{survey_link}}\n\nVielen Dank,\n{{clinic_name}}";

export function sampleEmailValues(value: string, campaignTitle: string) {
  return value
    .replaceAll("{{recipient_name}}", "Max Mustermann")
    .replaceAll("{{survey_link}}", "https://beispiel.de/umfrage")
    .replaceAll("{{clinic_name}}", "Musterklinik")
    .replaceAll("{{campaign_title}}", campaignTitle);
}

export function sanitizeEmailPreviewHtml(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/\son\w+\s*=\s*(["']).*?\1/gi, "")
    .replace(/javascript:/gi, "");
}

type EmailTemplateValues = { subject: string; htmlBody: string; textBody: string; senderName: string; replyTo: string };

export function EmailTemplateFields({
  campaignTitle,
  values,
  onChange,
  fieldNames,
  readOnly,
}: {
  campaignTitle: string;
  values: EmailTemplateValues;
  onChange: (next: Partial<EmailTemplateValues>) => void;
  fieldNames?: { subject: string; htmlBody: string; textBody: string; senderName: string; replyTo: string };
  readOnly?: boolean;
}) {
  const preview = useMemo(() => sanitizeEmailPreviewHtml(sampleEmailValues(values.htmlBody, campaignTitle)), [values.htmlBody, campaignTitle]);
  const appendVariable = (variable: string) => onChange({ htmlBody: `${values.htmlBody}${variable}` });

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(20rem,.9fr)]">
      <Card>
        <CardHeader>
          <CardTitle>Vorlage bearbeiten</CardTitle>
          <CardDescription>Die Vorlage wird beim ersten Versand gesperrt. Nutzen Sie die Platzhalter unten, sie werden beim Versand automatisch ersetzt.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <Field>
            <FieldLabel htmlFor="email-subject">Betreff</FieldLabel>
            <Input id="email-subject" name={fieldNames?.subject} required disabled={readOnly} value={values.subject} onChange={(event) => onChange({ subject: event.target.value })} />
          </Field>
          <Field>
            <FieldLabel htmlFor="email-sender-name">Absendername <span className="font-normal text-muted-foreground">(optional)</span></FieldLabel>
            <Input id="email-sender-name" name={fieldNames?.senderName} disabled={readOnly} value={values.senderName} onChange={(event) => onChange({ senderName: event.target.value })} />
          </Field>
          <Field>
            <FieldLabel htmlFor="email-reply-to">Antwortadresse <span className="font-normal text-muted-foreground">(optional)</span></FieldLabel>
            <Input id="email-reply-to" name={fieldNames?.replyTo} type="email" disabled={readOnly} value={values.replyTo} onChange={(event) => onChange({ replyTo: event.target.value })} />
          </Field>
          <Field>
            <FieldLabel htmlFor="email-html-body">HTML-Inhalt</FieldLabel>
            <Textarea id="email-html-body" name={fieldNames?.htmlBody} required rows={12} disabled={readOnly} value={values.htmlBody} onChange={(event) => onChange({ htmlBody: event.target.value })} />
          </Field>
          <Field>
            <FieldLabel htmlFor="email-text-body">Text-Inhalt <span className="font-normal text-muted-foreground">(Fallback ohne HTML)</span></FieldLabel>
            <Textarea id="email-text-body" name={fieldNames?.textBody} required rows={7} disabled={readOnly} value={values.textBody} onChange={(event) => onChange({ textBody: event.target.value })} />
          </Field>
          <div className="flex flex-wrap gap-2 text-sm">
            <span className="w-full text-muted-foreground">Platzhalter (in den HTML- oder Text-Inhalt einfügen):</span>
            {emailTemplateVariables.map((variable) => (
              <button key={variable} type="button" disabled={readOnly} className="rounded-md border px-2.5 py-1 font-mono text-xs hover:bg-muted disabled:pointer-events-none disabled:opacity-50" onClick={() => appendVariable(variable)}>
                {variable}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Live-Vorschau</CardTitle>
          <CardDescription>Mit Beispielwerten befüllt. Die HTML-Vorschau wird vor der Darstellung bereinigt.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="font-medium">{sampleEmailValues(values.subject, campaignTitle) || "(Kein Betreff)"}</p>
          <iframe title="Sichere E-Mail-Vorschau" sandbox="" srcDoc={preview} className="min-h-80 w-full rounded-md border bg-white" />
          <pre className="whitespace-pre-wrap rounded-md bg-muted p-3 text-sm">{sampleEmailValues(values.textBody, campaignTitle) || "(Kein Text-Inhalt)"}</pre>
        </CardContent>
      </Card>
    </div>
  );
}
