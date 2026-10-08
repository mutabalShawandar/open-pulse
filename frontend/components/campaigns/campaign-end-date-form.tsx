"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

function toLocalInputValue(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  const part = (number: number) => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${part(date.getMonth() + 1)}-${part(date.getDate())}T${part(date.getHours())}:${part(date.getMinutes())}`;
}

export function CampaignEndDateForm({ endsAt, action }: { endsAt: string | null; action: (formData: FormData) => void | Promise<void> }) {
  const t = useTranslations("campaigns.endDate");
  const [localEndDate, setLocalEndDate] = useState(() => toLocalInputValue(endsAt));
  const isoEndDate = localEndDate ? new Date(localEndDate).toISOString() : "";

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="endsAt" value={isoEndDate} />
      <Field>
        <FieldLabel htmlFor="campaign-ends-at">{t("endsAt")}</FieldLabel>
        <Input id="campaign-ends-at" type="datetime-local" value={localEndDate} onChange={(event) => setLocalEndDate(event.target.value)} />
        <FieldDescription>{t("hint")}</FieldDescription>
      </Field>
      <div className="flex gap-2">
        <SaveEndDateButton />
        {localEndDate ? <Button type="button" variant="outline" onClick={() => setLocalEndDate("")}>{t("remove")}</Button> : null}
      </div>
    </form>
  );
}

function SaveEndDateButton() {
  const t = useTranslations("campaigns.endDate");
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending} aria-busy={pending}>{pending ? <Spinner data-icon="inline-start" /> : null}{pending ? t("saving") : t("save")}</Button>;
}
