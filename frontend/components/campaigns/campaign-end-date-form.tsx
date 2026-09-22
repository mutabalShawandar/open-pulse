"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

function toLocalInputValue(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  const part = (number: number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${part(date.getMonth() + 1)}-${part(date.getDate())}T${part(date.getHours())}:${part(date.getMinutes())}`;
}

export function CampaignEndDateForm({ endsAt, action }: { endsAt: string | null; action: (formData: FormData) => void | Promise<void> }) {
  const [localEndDate, setLocalEndDate] = useState(() => toLocalInputValue(endsAt));
  const isoEndDate = localEndDate ? new Date(localEndDate).toISOString() : "";

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="endsAt" value={isoEndDate} />
      <Field>
        <FieldLabel htmlFor="campaign-ends-at">Endet am</FieldLabel>
        <Input id="campaign-ends-at" type="datetime-local" value={localEndDate} onChange={(event) => setLocalEndDate(event.target.value)} />
        <FieldDescription>Die Kampagne wird zu diesem Zeitpunkt automatisch abgeschlossen. Laufende oder neue Antworten sind danach nicht mehr möglich.</FieldDescription>
      </Field>
      <div className="flex gap-2"><Button type="submit">Enddatum speichern</Button>{localEndDate ? <Button type="button" variant="outline" onClick={() => setLocalEndDate("")}>Enddatum entfernen</Button> : null}</div>
    </form>
  );
}
