"use client";

import { useTranslations } from "next-intl";
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
  const t = useTranslations("surveys.newDraft");
  return (
    <Dialog>
      <DialogTrigger render={<Button className="w-full" variant="outline" />}>
        <FilePlus2Icon data-icon="inline-start" />
        {t("trigger")}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <form action={action}>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="draft-label">{t("label")}</FieldLabel>
              <Input id="draft-label" name="draftLabel" placeholder={t("labelPlaceholder")} />
              <FieldDescription>{t("labelHint")}</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="draft-source-version">{t("takeOver")}</FieldLabel>
              <NativeSelect defaultValue="" id="draft-source-version" name="sourceVersionId">
                <NativeSelectOption value="">{t("empty")}</NativeSelectOption>
                {sourceVersions.map((sourceVersion) => (
                  <NativeSelectOption key={sourceVersion.id} value={sourceVersion.id}>
                    {sourceVersion.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <FieldDescription>{t("takeOverHint")}</FieldDescription>
            </Field>
          </FieldGroup>
          <DialogFooter className="mt-5">
            <DialogClose render={<Button type="button" variant="outline" />}>{t("cancel")}</DialogClose>
            <Button type="submit">
              <FilePlus2Icon data-icon="inline-start" />
              {t("submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
