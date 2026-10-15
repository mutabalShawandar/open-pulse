"use client";

import { useTranslations } from "next-intl";
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
  const t = useTranslations("surveys.copy");
  if (!sourceVersions.length) {
    return (
      <Button disabled variant="outline">
        <CopyIcon data-icon="inline-start" />
        {t("trigger")}
      </Button>
    );
  }

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" />}>
        <CopyIcon data-icon="inline-start" />
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
              <FieldLabel htmlFor="source-version">{t("source")}</FieldLabel>
              <NativeSelect defaultValue={sourceVersions[0].id} id="source-version" name="sourceVersionId" required>
                {sourceVersions.map((sourceVersion) => (
                  <NativeSelectOption key={sourceVersion.id} value={sourceVersion.id}>
                    {sourceVersion.label}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <FieldDescription>{t("sourceHint")}</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="copy-title">{t("copyTitle")}</FieldLabel>
              <Input defaultValue={`${surveyTitle} – ${t("copySuffix")}`} id="copy-title" name="copyTitle" required />
            </Field>
            <Field>
              <FieldLabel htmlFor="copy-description">{t("fDescription")}</FieldLabel>
              <Textarea defaultValue={description ?? ""} id="copy-description" name="copyDescription" rows={3} />
            </Field>
          </FieldGroup>
          <DialogFooter className="mt-5">
            <DialogClose render={<Button type="button" variant="outline" />}>{t("cancel")}</DialogClose>
            <Button type="submit">
              <CopyIcon data-icon="inline-start" />
              {t("submit")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
