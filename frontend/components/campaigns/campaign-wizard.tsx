"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckIcon, PlusIcon, Trash2Icon } from "lucide-react";

import { importWizardRecipientsAction, submitCampaignWizardAction } from "@/app/(platform)/clinics/[clinicId]/campaigns/actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { defaultEmailHtmlBody, defaultEmailSubject, defaultEmailTextBody, EmailTemplateFields } from "@/components/campaigns/email-template-fields";
import type { PublishedSurveyVersionOption, Recipient } from "@/lib/api/types";

type Step = 1 | 2 | 3 | 4;

const stepLabels: Record<Step, string> = {
  1: "Details",
  2: "Empfänger",
  3: "E-Mail-Vorlage",
  4: "Umfrage & Überprüfung",
};

type ManualRow = { id: number; name: string; email: string };

export function CampaignWizard({ clinicId, initialRecipients, surveyVersionOptions }: { clinicId: string; initialRecipients: Recipient[]; surveyVersionOptions: PublishedSurveyVersionOption[] }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [endsAt, setEndsAt] = useState("");

  const [recipients, setRecipients] = useState<Recipient[]>(initialRecipients);
  const [selectedRecipientIds, setSelectedRecipientIds] = useState<Set<string>>(new Set());
  const [manualRows, setManualRows] = useState<ManualRow[]>([{ id: 0, name: "", email: "" }]);
  const [importMessage, setImportMessage] = useState<string | null>(null);

  const [email, setEmail] = useState({ subject: defaultEmailSubject, htmlBody: defaultEmailHtmlBody, textBody: defaultEmailTextBody, senderName: "", replyTo: "" });

  const [surveyVersionId, setSurveyVersionId] = useState("");

  const selectedSurveyLabel = useMemo(() => surveyVersionOptions.find((option) => option.id === surveyVersionId)?.label, [surveyVersionOptions, surveyVersionId]);

  const canGoNext = step === 1 ? title.trim().length > 0 : true;

  const toggleRecipient = (id: string) => setSelectedRecipientIds((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const addManualRow = () => setManualRows((current) => [...current, { id: Date.now(), name: "", email: "" }]);
  const removeManualRow = (id: number) => setManualRows((current) => current.length === 1 ? current : current.filter((row) => row.id !== id));
  const updateManualRow = (id: number, field: "name" | "email", value: string) => setManualRows((current) => current.map((row) => row.id === id ? { ...row, [field]: value } : row));

  const importManualRecipients = () => {
    const toImport = manualRows.map((row) => ({ display_name: row.name.trim() || null, email: row.email.trim() })).filter((row) => row.email);
    if (!toImport.length) return;
    setImportMessage(null);
    startTransition(async () => {
      const result = await importWizardRecipientsAction(clinicId, toImport);
      if (!result.ok) { setImportMessage(result.error); return; }
      setRecipients(result.recipients);
      setSelectedRecipientIds((current) => {
        const next = new Set(current);
        const importedEmails = new Set(toImport.map((row) => row.email.toLowerCase()));
        for (const recipient of result.recipients) if (importedEmails.has(recipient.email.toLowerCase())) next.add(recipient.id);
        return next;
      });
      setManualRows([{ id: Date.now(), name: "", email: "" }]);
      setImportMessage(`${result.createdCount} neu importiert, ${result.duplicateCount} bereits vorhanden.`);
    });
  };

  const importCsvFile = (file: File) => {
    setImportMessage(null);
    startTransition(async () => {
      const text = (await file.text()).replace(/^﻿/, "");
      const toImport = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).map((row) => {
        const [displayName, email] = row.includes(";") ? row.split(";", 2) : row.includes(",") ? row.split(",", 2) : ["", row];
        return { display_name: displayName.trim() || null, email: email.trim() };
      }).filter((row) => row.email && row.email.toLowerCase() !== "email" && row.email.toLowerCase() !== "e-mail");
      if (!toImport.length) { setImportMessage("Die Datei enthielt keine gültigen E-Mail-Adressen."); return; }
      const result = await importWizardRecipientsAction(clinicId, toImport);
      if (!result.ok) { setImportMessage(result.error); return; }
      setRecipients(result.recipients);
      setSelectedRecipientIds((current) => {
        const next = new Set(current);
        const importedEmails = new Set(toImport.map((row) => row.email.toLowerCase()));
        for (const recipient of result.recipients) if (importedEmails.has(recipient.email.toLowerCase())) next.add(recipient.id);
        return next;
      });
      setImportMessage(`${result.createdCount} neu importiert, ${result.duplicateCount} bereits vorhanden.`);
    });
  };

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const result = await submitCampaignWizardAction({
        clinicId,
        title,
        description,
        endsAt: endsAt ? new Date(endsAt).toISOString() : null,
        surveyVersionId,
        recipientIds: [...selectedRecipientIds],
        email: email.subject.trim() ? email : null,
      });
      if (!result.ok) { setError(result.error); return; }
      router.push(`/clinics/${clinicId}/campaigns/${result.campaignId}`);
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <ol className="flex flex-wrap gap-2 text-sm">
        {([1, 2, 3, 4] as Step[]).map((value) => (
          <li key={value} className={`flex items-center gap-2 rounded-full border px-3 py-1.5 ${step === value ? "border-primary bg-primary/10 font-medium text-primary" : "text-muted-foreground"}`}>
            <span className={`flex size-5 items-center justify-center rounded-full text-xs ${step > value ? "bg-primary text-primary-foreground" : "border"}`}>{step > value ? <CheckIcon className="size-3" /> : value}</span>
            {stepLabels[value]}
          </li>
        ))}
      </ol>

      {step === 1 ? (
        <Card>
          <CardHeader><CardTitle>Details</CardTitle><CardDescription>Titel und Beschreibung der Kampagne.</CardDescription></CardHeader>
          <CardContent className="flex flex-col gap-5">
            <Field><FieldLabel htmlFor="wizard-title">Titel</FieldLabel><Input id="wizard-title" required value={title} onChange={(event) => setTitle(event.target.value)} /></Field>
            <Field><FieldLabel htmlFor="wizard-description">Beschreibung</FieldLabel><Textarea id="wizard-description" value={description} onChange={(event) => setDescription(event.target.value)} /></Field>
            <Field><FieldLabel htmlFor="wizard-ends-at">Endet am <span className="font-normal text-muted-foreground">(optional)</span></FieldLabel><Input id="wizard-ends-at" type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} /><FieldDescription>Nach diesem Zeitpunkt wird die Kampagne automatisch beendet und nimmt keine Antworten mehr an.</FieldDescription></Field>
          </CardContent>
        </Card>
      ) : null}

      {step === 2 ? (
        <Card>
          <CardHeader><CardTitle>Empfänger</CardTitle><CardDescription>Importieren Sie Empfänger und wählen Sie aus, wer dieser Kampagne zugeordnet werden soll. Dieser Schritt ist optional und kann später ergänzt werden.</CardDescription></CardHeader>
          <CardContent className="flex flex-col gap-6">
            <div className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-3">
              {manualRows.map((row) => (
                <div key={row.id} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
                  <Field><FieldLabel>Name <span className="font-normal text-muted-foreground">(optional)</span></FieldLabel><Input value={row.name} onChange={(event) => updateManualRow(row.id, "name", event.target.value)} /></Field>
                  <Field><FieldLabel>E-Mail-Adresse</FieldLabel><Input type="email" value={row.email} onChange={(event) => updateManualRow(row.id, "email", event.target.value)} /></Field>
                  <Button type="button" variant="ghost" size="icon" disabled={manualRows.length === 1} onClick={() => removeManualRow(row.id)}><Trash2Icon /></Button>
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={addManualRow}><PlusIcon data-icon="inline-start" />Weitere Zeile</Button>
                <Button type="button" size="sm" disabled={isPending} onClick={importManualRecipients}>Importieren</Button>
              </div>
            </div>
            <Field>
              <FieldLabel htmlFor="wizard-recipient-file">Oder CSV-Datei importieren</FieldLabel>
              <input id="wizard-recipient-file" type="file" accept=".csv,text/csv,text/plain" className="block text-sm" onChange={(event) => { const file = event.target.files?.[0]; if (file) importCsvFile(file); event.target.value = ""; }} />
              <FieldDescription>Spalten „Name;E-Mail“ oder nur „E-Mail“. Maximal 2.000 Empfänger und 2 MB.</FieldDescription>
            </Field>
            {importMessage ? <p className="text-sm text-muted-foreground">{importMessage}</p> : null}
            <div>
              <p className="mb-2 text-sm font-medium">Für diese Kampagne auswählen ({selectedRecipientIds.size} ausgewählt)</p>
              {recipients.length ? (
                <div className="max-h-72 overflow-y-auto rounded-md border">
                  {recipients.map((recipient) => (
                    <label key={recipient.id} className="flex items-center gap-3 border-b px-3 py-2 last:border-0">
                      <input type="checkbox" checked={selectedRecipientIds.has(recipient.id)} onChange={() => toggleRecipient(recipient.id)} />
                      <span>{recipient.display_name || recipient.email}{recipient.display_name ? <span className="text-muted-foreground"> · {recipient.email}</span> : null}</span>
                    </label>
                  ))}
                </div>
              ) : <p className="text-sm text-muted-foreground">Noch keine Empfänger für diese Klinik vorhanden.</p>}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {step === 3 ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">Eine sinnvolle Standardvorlage ist bereits ausgefüllt — passen Sie sie an oder übernehmen Sie sie unverändert. Kann auch später auf der Kampagnenseite ergänzt werden.</p>
          <EmailTemplateFields campaignTitle={title || "Ihre Kampagne"} values={email} onChange={(next) => setEmail((current) => ({ ...current, ...next }))} />
        </div>
      ) : null}

      {step === 4 ? (
        <Card>
          <CardHeader><CardTitle>Umfrage & Überprüfung</CardTitle><CardDescription>Wählen Sie die veröffentlichte Umfrageversion, die für diese Kampagne verwendet wird.</CardDescription></CardHeader>
          <CardContent className="flex flex-col gap-6">
            <Field>
              <FieldLabel htmlFor="wizard-survey-version">Veröffentlichte Umfrageversion</FieldLabel>
              {surveyVersionOptions.length ? (
                <NativeSelect id="wizard-survey-version" required value={surveyVersionId} onChange={(event) => setSurveyVersionId(event.target.value)}>
                  <NativeSelectOption value="" disabled>Version auswählen</NativeSelectOption>
                  {surveyVersionOptions.map((option) => <NativeSelectOption key={option.id} value={option.id}>{option.label}</NativeSelectOption>)}
                </NativeSelect>
              ) : <p className="text-sm text-muted-foreground">Dieser Klinik ist noch keine veröffentlichte Umfrageversion zugeordnet. Ordnen Sie zuerst eine Version über die Klinikseite zu.</p>}
            </Field>
            <div className="rounded-lg border bg-muted/20 p-4 text-sm">
              <p className="font-medium">Zusammenfassung</p>
              <dl className="mt-3 grid gap-2">
                <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Titel</dt><dd className="text-right">{title || "—"}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Empfänger</dt><dd className="text-right">{selectedRecipientIds.size} ausgewählt</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-muted-foreground">E-Mail-Vorlage</dt><dd className="text-right">{email.subject.trim() ? `Betreff: ${email.subject}` : "Noch nicht hinterlegt"}</dd></div>
                <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Umfrageversion</dt><dd className="text-right">{selectedSurveyLabel ?? "—"}</dd></div>
              </dl>
            </div>
            {error ? <Alert variant="destructive"><AlertTitle>Fehler</AlertTitle><AlertDescription>{error}</AlertDescription></Alert> : null}
          </CardContent>
        </Card>
      ) : null}

      <div className="flex justify-between">
        <Button type="button" variant="outline" disabled={step === 1 || isPending} onClick={() => setStep((current) => (current - 1) as Step)}>Zurück</Button>
        {step < 4 ? (
          <Button type="button" disabled={!canGoNext} onClick={() => setStep((current) => (current + 1) as Step)}>Weiter</Button>
        ) : (
          <Button type="button" disabled={isPending || !surveyVersionId} onClick={submit}>{isPending ? "Wird erstellt …" : "Kampagne erstellen"}</Button>
        )}
      </div>
    </div>
  );
}
