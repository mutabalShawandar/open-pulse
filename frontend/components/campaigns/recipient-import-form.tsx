"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";

type RecipientRow = { id: number };

export function RecipientImportForm({ action, submitLabel = "Empfänger importieren und hinzufügen" }: { action: (formData: FormData) => void | Promise<void>; submitLabel?: string }) {
  const [rows, setRows] = useState<RecipientRow[]>([{ id: 0 }]);

  const addRow = () => setRows((current) => [...current, { id: Date.now() }]);
  const removeRow = (id: number) => setRows((current) => current.length === 1 ? current : current.filter((row) => row.id !== id));

  return (
    <form action={action} className="flex flex-col gap-5">
      <FieldGroup>
        {rows.map((row, index) => (
          <div key={row.id} className="grid gap-3 rounded-lg border bg-muted/20 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
            <Field>
              <FieldLabel htmlFor={`recipient-name-${row.id}`}>Name <span className="font-normal text-muted-foreground">(optional)</span></FieldLabel>
              <input id={`recipient-name-${row.id}`} name="recipientName" type="text" autoComplete="name" maxLength={255} className="h-8 rounded-md border bg-background px-2.5 text-sm" />
            </Field>
            <Field>
              <FieldLabel htmlFor={`recipient-email-${row.id}`}>E-Mail-Adresse</FieldLabel>
              <input id={`recipient-email-${row.id}`} name="recipientEmail" type="email" required autoComplete="email" maxLength={320} className="h-8 rounded-md border bg-background px-2.5 text-sm" />
            </Field>
            <Button type="button" variant="ghost" size="icon" aria-label={`Empfänger ${index + 1} entfernen`} disabled={rows.length === 1} onClick={() => removeRow(row.id)}>
              <Trash2Icon />
            </Button>
          </div>
        ))}
      </FieldGroup>

      <Button type="button" variant="outline" className="w-fit" onClick={addRow}>
        <PlusIcon data-icon="inline-start" />
        Weiteren Empfänger hinzufügen
      </Button>

      <div className="flex flex-col gap-2 border-t pt-5">
        <Field>
          <FieldLabel htmlFor="recipient-file">Oder CSV-Datei importieren</FieldLabel>
          <input id="recipient-file" name="recipientFile" type="file" accept=".csv,text/csv,text/plain" className="block text-sm" />
          <FieldDescription>Für größere Listen: Spalten „Name;E-Mail“ oder nur „E-Mail“. Maximal 2.000 Empfänger und 2 MB.</FieldDescription>
        </Field>
      </div>

      <Button className="w-fit" type="submit">{submitLabel}</Button>
    </form>
  );
}
