"use client";

import { useTranslations } from "next-intl";
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
  const t = useTranslations("campaigns.changeVersion");
  const selectableOptions = options.filter((option) => option.id !== currentSurveyVersionId);

  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="outline" disabled={disabled} />}>
        <RefreshCwIcon data-icon="inline-start" />
        {t("trigger")}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia><RefreshCwIcon /></AlertDialogMedia>
          <AlertDialogTitle>{t("title")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("description", { current: currentLabel })}
            {disabled ? ` ${t("locked")}` : ""}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {selectableOptions.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("none")}</p>
        ) : (
          <form action={changeAction.bind(null, campaignId)} className="flex flex-col gap-4">
            <Field>
              <FieldLabel htmlFor="surveyVersionId">{t("newVersion")}</FieldLabel>
              <NativeSelect id="surveyVersionId" name="surveyVersionId" className="w-full" required defaultValue="">
                <NativeSelectOption value="" disabled>{t("choose")}</NativeSelectOption>
                {selectableOptions.map((option) => (
                  <NativeSelectOption key={option.id} value={option.id}>{option.label}</NativeSelectOption>
                ))}
              </NativeSelect>
              <FieldDescription>{t("pinHint")}</FieldDescription>
            </Field>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
              <AlertDialogAction type="submit">{t("submit")}</AlertDialogAction>
            </AlertDialogFooter>
          </form>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
