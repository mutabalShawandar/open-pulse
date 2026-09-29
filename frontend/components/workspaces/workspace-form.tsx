"use client";

import { useFormStatus } from "react-dom";
import { ImagePlusIcon, SaveIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import type { WorkspaceInput } from "@/lib/api/types";

type WorkspaceFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  workspace?: WorkspaceInput;
  submitLabel: string;
};

export function WorkspaceForm({ action, workspace, submitLabel }: WorkspaceFormProps) {
  return (
    <form action={action}>
      <FieldGroup>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="name">Klinikname</FieldLabel>
            <Input id="name" name="name" defaultValue={workspace?.name} required />
          </Field>
          <Field>
            <FieldLabel htmlFor="slug">Interne Kennung</FieldLabel>
            <Input id="slug" name="slug" defaultValue={workspace?.slug} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required />
            <FieldDescription>Nur Kleinbuchstaben, Zahlen und Bindestriche.</FieldDescription>
          </Field>
        </div>
        <Field>
          <FieldLabel htmlFor="logo">Kliniklogo</FieldLabel>
          <div className="flex items-center gap-4 rounded-xl border bg-muted/30 p-3">
            {workspace?.logo_url ? (
              <img src={workspace.logo_url} alt="Aktuelles Kliniklogo" className="size-14 rounded-lg bg-white object-contain p-1" />
            ) : (
              <div className="flex size-14 items-center justify-center rounded-lg bg-background text-muted-foreground">
                <ImagePlusIcon className="size-5" />
              </div>
            )}
            <Input id="logo" name="logo" type="file" accept="image/png,image/jpeg,image/webp" className="max-w-sm bg-background" />
          </div>
          <FieldDescription>Optional: PNG, JPG oder WebP, maximal 2 MB. Das Logo wird sicher gespeichert und für Umfragen und Kampagnen verwendet.</FieldDescription>
        </Field>
        <div className="border-t pt-5">
          <p className="font-medium">Standort</p>
          <p className="mt-1 text-sm text-muted-foreground">Diese Angaben können später für die Umfrageausspielung verwendet werden.</p>
        </div>
        <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_8rem]">
          <Field>
            <FieldLabel htmlFor="street">Straße</FieldLabel>
            <Input id="street" name="street" defaultValue={workspace?.street ?? ""} />
          </Field>
          <Field>
            <FieldLabel htmlFor="hausnummer">Hausnummer</FieldLabel>
            <Input id="hausnummer" name="hausnummer" type="number" min="1" step="1" defaultValue={workspace?.hausnummer ?? ""} />
          </Field>
        </div>
        <div className="grid gap-5 sm:grid-cols-[9rem_minmax(0,1fr)]">
          <Field>
            <FieldLabel htmlFor="postalCode">PLZ</FieldLabel>
            <Input id="postalCode" name="postalCode" defaultValue={workspace?.postal_code ?? ""} />
          </Field>
          <Field>
            <FieldLabel htmlFor="city">Ort</FieldLabel>
            <Input id="city" name="city" defaultValue={workspace?.city ?? ""} />
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
      {pending ? <Spinner data-icon="inline-start" /> : <SaveIcon data-icon="inline-start" />}
      {pending ? "Wird gespeichert …" : label}
    </Button>
  );
}
