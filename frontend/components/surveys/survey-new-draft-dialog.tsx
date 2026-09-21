"use client";

import { FilePlus2Icon } from "lucide-react";

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

type SourceVersion = {
  id: string;
  label: string;
};

export function SurveyNewDraftDialog({
  action,
  sourceVersions,
}: {
  action: (formData: FormData) => void | Promise<void>;
  sourceVersions: SourceVersion[];
}) {
  return (
    <Dialog>
      <DialogTrigger render={<Button className="w-full" variant="outline" />}>
        <FilePlus2Icon data-icon="inline-start" />
        Neuen Entwurf anlegen
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Neuen Entwurf anlegen</DialogTitle>
          <DialogDescription>
            Erstelle eine leere Arbeitsversion oder übernimm eine vorhandene Version, um sie sicher weiterzuentwickeln.
          </DialogDescription>
        </DialogHeader>
        <form action={action}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="draft-label">Bezeichnung</FieldLabel>
              <Input id="draft-label" name="draftLabel" placeholder="z. B. Überarbeitung 2026" />
              <FieldDescription>Optional. Die Bezeichnung hilft bei mehreren parallelen Entwürfen.</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="draft-source-version">Inhalt übernehmen</FieldLabel>
              <NativeSelect defaultValue="" id="draft-source-version" name="sourceVersionId">
                <NativeSelectOption value="">Leer beginnen</NativeSelectOption>
                {sourceVersions.map((sourceVersion) => (
                  <NativeSelectOption key={sourceVersion.id} value={sourceVersion.id}>
                    {sourceVersion.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <FieldDescription>
                Beim Übernehmen werden Abschnitte, Fragen, Optionen und Validierungen in einen neuen bearbeitbaren Entwurf kopiert.
              </FieldDescription>
            </Field>
          </FieldGroup>
          <DialogFooter className="mt-5">
            <DialogClose render={<Button type="button" variant="outline" />}>Abbrechen</DialogClose>
            <Button type="submit">
              <FilePlus2Icon data-icon="inline-start" />
              Entwurf anlegen
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
