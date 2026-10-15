"use client";

import { useFormStatus } from "react-dom";
import { useFormatter, useTranslations } from "next-intl";
import { ClipboardCheckIcon, LinkIcon, Trash2Icon } from "lucide-react";

import {
  assignSurveyVersionAction,
  unassignSurveyVersionAction,
} from "@/app/(platform)/workspaces/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import type {
  WorkspaceSurveyVersionAssignment,
  PublishedSurveyVersionOption,
} from "@/lib/api/types";

type WorkspaceSurveyVersionsProps = {
  assignments: WorkspaceSurveyVersionAssignment[];
  workspaceSlug: string;
  options: PublishedSurveyVersionOption[] | null;
};

export function WorkspaceSurveyVersions({ assignments, workspaceSlug, options }: WorkspaceSurveyVersionsProps) {
  const t = useTranslations("surveys.assign");
  const format = useFormatter();
  const assignedIds = new Set(assignments.map((assignment) => assignment.survey_version_id));
  const assignableOptions = options?.filter((option) => !assignedIds.has(option.id)) ?? [];
  const labels = new Map(options?.map((option) => [option.id, option.label]));

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <section className="min-w-0">
        {assignments.length === 0 ? (
          <div className="rounded-xl border border-dashed p-6 text-center">
            <ClipboardCheckIcon className="mx-auto size-5 text-muted-foreground" />
            <p className="mt-3 font-medium">{t("none")}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t("noneHint")}</p>
          </div>
        ) : (
          <ul className="divide-y rounded-xl border">
            {assignments.map((assignment) => (
              <li key={assignment.id} className="flex items-center gap-3 p-4">
                <div className="flex size-9 items-center justify-center rounded-lg bg-secondary text-secondary-foreground">
                  <ClipboardCheckIcon className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {labels.get(assignment.survey_version_id) ?? t("unknownVersion", { id: assignment.survey_version_id })}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t("assignedOn", { date: format.dateTime(new Date(assignment.assigned_at), { day: "2-digit", month: "2-digit", year: "numeric" }) })}
                  </p>
                </div>
                <Badge variant="secondary">{t("active")}</Badge>
                {options ? (
                  <UnassignVersionDialog
                    workspaceSlug={workspaceSlug}
                    surveyVersionId={assignment.survey_version_id}
                    surveyVersionName={labels.get(assignment.survey_version_id) ?? t("thisVersion")}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="rounded-xl border bg-muted/25 p-4">
        <p className="font-medium">{t("title")}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t("hint")}</p>
        {options === null ? (
          <p className="mt-5 text-sm text-muted-foreground">{t("noAccess")}</p>
        ) : assignableOptions.length === 0 ? (
          <p className="mt-5 text-sm text-muted-foreground">{t("noMore")}</p>
        ) : (
          <form action={assignSurveyVersionAction.bind(null, workspaceSlug)} className="mt-5">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="surveyVersionId">{t("published")}</FieldLabel>
                <NativeSelect id="surveyVersionId" name="surveyVersionId" className="w-full" required defaultValue="">
                  <NativeSelectOption value="" disabled>{t("choose")}</NativeSelectOption>
                  {assignableOptions.map((option) => (
                    <NativeSelectOption key={option.id} value={option.id}>{option.label}</NativeSelectOption>
                  ))}
                </NativeSelect>
                <FieldDescription>{t("pinHint")}</FieldDescription>
              </Field>
              <AssignButton />
            </FieldGroup>
          </form>
        )}
      </section>
    </div>
  );
}

function AssignButton() {
  const t = useTranslations("surveys.assign");
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? <Spinner data-icon="inline-start" /> : <LinkIcon data-icon="inline-start" />}
      {pending ? t("assigning") : t("assign")}
    </Button>
  );
}

function UnassignVersionDialog({
  workspaceSlug,
  surveyVersionId,
  surveyVersionName,
}: {
  workspaceSlug: string;
  surveyVersionId: string;
  surveyVersionName: string;
}) {
  const t = useTranslations("surveys.assign");
  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="ghost" size="icon-sm" />}>
        <Trash2Icon />
        <span className="sr-only">{t("remove", { name: surveyVersionName })}</span>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia><Trash2Icon /></AlertDialogMedia>
          <AlertDialogTitle>{t("unassignTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{t("unassignDescription", { name: surveyVersionName })}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
          <form action={unassignSurveyVersionAction.bind(null, workspaceSlug)}>
            <input type="hidden" name="surveyVersionId" value={surveyVersionId} />
            <AlertDialogAction type="submit" variant="destructive">{t("unassign")}</AlertDialogAction>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
