"use client";

import { RefreshCwIcon } from "lucide-react";

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogMedia, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import type { PublishedSurveyVersionOption } from "@/lib/api/types";

type ChangeSurveyVersionDialogProps = {
  campaignId: string;
  currentSurveyVersionId: string;
  currentLabel: string;
  options: PublishedSurveyVersionOption[];
  changeAction: (campaignId: string, formData: FormData) => Promise<void>;
  disabled?: boolean;
};

export function ChangeSurveyVersionDialog({ campaignId, currentSurveyVersionId, currentLabel, options, changeAction, disabled }: ChangeSurveyVersionDialogProps) {
  const selectableOptions = options.filter((option) => option.id !== currentSurveyVersionId);

  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="outline" disabled={disabled} />}>
        <RefreshCwIcon data-icon="inline-start" />
        Umfrage ändern
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia><RefreshCwIcon /></AlertDialogMedia>
          <AlertDialogTitle>Verknüpfte Umfrage ändern</AlertDialogTitle>
          <AlertDialogDescription>
            Aktuell zugeordnet: {currentLabel}. Nur veröffentlichte Versionen, die dieser Klinik zugeordnet sind, stehen zur Auswahl.
            {disabled ? " Sobald Antworten vorliegen, kann die Version nicht mehr geändert werden." : ""}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {selectableOptions.length === 0 ? (
          <p className="text-sm text-muted-foreground">Es ist keine andere veröffentlichte Version für diese Klinik verfügbar.</p>
        ) : (
          <form action={changeAction.bind(null, campaignId)} className="flex flex-col gap-4">
            <Field>
              <FieldLabel htmlFor="surveyVersionId">Neue Umfrageversion</FieldLabel>
              <NativeSelect id="surveyVersionId" name="surveyVersionId" className="w-full" required defaultValue="">
                <NativeSelectOption value="" disabled>Version auswählen</NativeSelectOption>
                {selectableOptions.map((option) => (
                  <NativeSelectOption key={option.id} value={option.id}>{option.label}</NativeSelectOption>
                ))}
              </NativeSelect>
              <FieldDescription>Die Kampagne wird exakt an diese unveränderliche Version gebunden.</FieldDescription>
            </Field>
            <AlertDialogFooter>
              <AlertDialogCancel>Abbrechen</AlertDialogCancel>
              <AlertDialogAction type="submit">Umfrage ändern</AlertDialogAction>
            </AlertDialogFooter>
          </form>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
