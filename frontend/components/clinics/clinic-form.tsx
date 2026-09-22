"use client";

import { useFormStatus } from "react-dom";
import { SaveIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { ClinicInput } from "@/lib/api/types";

type ClinicFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  clinic?: ClinicInput;
  submitLabel: string;
  showLogoUrl?: boolean;
};

export function ClinicForm({ action, clinic, submitLabel, showLogoUrl = true }: ClinicFormProps) {
  return (
    <form action={action}>
      <FieldGroup>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="name">Klinikname</FieldLabel>
            <Input id="name" name="name" defaultValue={clinic?.name} required />
          </Field>
          <Field>
            <FieldLabel htmlFor="slug">Interne Kennung</FieldLabel>
            <Input
              id="slug"
              name="slug"
              defaultValue={clinic?.slug}
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              required
            />
            <FieldDescription>Nur Kleinbuchstaben, Zahlen und Bindestriche.</FieldDescription>
          </Field>
        </div>
        {showLogoUrl ? (
          <Field>
            <FieldLabel htmlFor="logoUrl">Logo-URL</FieldLabel>
            <Input id="logoUrl" name="logoUrl" type="url" defaultValue={clinic?.logo_url ?? ""} />
            <FieldDescription>Optional. Eine öffentlich erreichbare Bildadresse.</FieldDescription>
          </Field>
        ) : null}
        <div className="border-t pt-5">
          <p className="font-medium">Standort</p>
          <p className="mt-1 text-sm text-muted-foreground">Diese Angaben können später für die Umfrageausspielung verwendet werden.</p>
        </div>
        <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_8rem]">
          <Field>
            <FieldLabel htmlFor="street">Straße</FieldLabel>
            <Input id="street" name="street" defaultValue={clinic?.street ?? ""} />
          </Field>
          <Field>
            <FieldLabel htmlFor="hausnummer">Hausnummer</FieldLabel>
            <Input
              id="hausnummer"
              name="hausnummer"
              type="number"
              min="1"
              step="1"
              defaultValue={clinic?.hausnummer ?? ""}
            />
          </Field>
        </div>
        <div className="grid gap-5 sm:grid-cols-[9rem_minmax(0,1fr)]">
          <Field>
            <FieldLabel htmlFor="postalCode">PLZ</FieldLabel>
            <Input id="postalCode" name="postalCode" defaultValue={clinic?.postal_code ?? ""} />
          </Field>
          <Field>
            <FieldLabel htmlFor="city">Ort</FieldLabel>
            <Input id="city" name="city" defaultValue={clinic?.city ?? ""} />
          </Field>
        </div>
        <SubmitButton label={submitLabel} />
      </FieldGroup>
    </form>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending} className="w-full sm:w-fit">
      <SaveIcon data-icon="inline-start" />
      {pending ? "Wird gespeichert …" : label}
    </Button>
  );
}
