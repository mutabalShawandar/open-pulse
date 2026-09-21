"use client";

import { CopyIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

type SourceVersion = {
  id: string;
  label: string;
};

export function SurveyCopyDialog({
  action,
  description,
  sourceVersions,
  surveyTitle,
}: {
  action: (formData: FormData) => void | Promise<void>;
  description: string | null;
  sourceVersions: SourceVersion[];
  surveyTitle: string;
}) {
  if (!sourceVersions.length) {
    return (
      <Button disabled variant="outline">
        <CopyIcon data-icon="inline-start" />
        Kopie erstellen
      </Button>
    );
  }

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" />}>
        <CopyIcon data-icon="inline-start" />
        Kopie erstellen
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Vorlage für eine Klinik kopieren</DialogTitle>
          <DialogDescription>
            Inhalt, Fragen und Regeln werden in einen eigenständigen Entwurf kopiert. Passe den Titel für die Klinik jetzt an.
          </DialogDescription>
        </DialogHeader>
        <form action={action}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="source-version">Ausgangsversion</FieldLabel>
              <NativeSelect defaultValue={sourceVersions[0].id} id="source-version" name="sourceVersionId" required>
                {sourceVersions.map((sourceVersion) => (
                  <NativeSelectOption key={sourceVersion.id} value={sourceVersion.id}>
                    {sourceVersion.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <FieldDescription>Wähle den Entwurf oder die veröffentlichte Version, die als Vorlage dienen soll.</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="copy-title">Titel der Kopie</FieldLabel>
              <Input defaultValue={`${surveyTitle} – Klinik`} id="copy-title" name="copyTitle" required />
            </Field>
            <Field>
              <FieldLabel htmlFor="copy-description">Beschreibung</FieldLabel>
              <Textarea defaultValue={description ?? ""} id="copy-description" name="copyDescription" rows={3} />
            </Field>
          </FieldGroup>
          <DialogFooter className="mt-5">
            <DialogClose render={<Button type="button" variant="outline" />}>Abbrechen</DialogClose>
            <Button type="submit">
              <CopyIcon data-icon="inline-start" />
              Kopie anlegen
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
