"use client";

import { useFormStatus } from "react-dom";
import { ClipboardCheckIcon, LinkIcon, Trash2Icon } from "lucide-react";

import {
  assignSurveyVersionAction,
  unassignSurveyVersionAction,
} from "@/app/(platform)/clinics/actions";
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
import type {
  ClinicSurveyVersionAssignment,
  PublishedSurveyVersionOption,
} from "@/lib/api/types";

type ClinicSurveyVersionsProps = {
  assignments: ClinicSurveyVersionAssignment[];
  clinicSlug: string;
  options: PublishedSurveyVersionOption[] | null;
};

const dateFormatter = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export function ClinicSurveyVersions({ assignments, clinicId, clinicSlug, options }: ClinicSurveyVersionsProps) {
  const assignedIds = new Set(assignments.map((assignment) => assignment.survey_version_id));
  const assignableOptions = options?.filter((option) => !assignedIds.has(option.id)) ?? [];
  const labels = new Map(options?.map((option) => [option.id, option.label]));

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <section className="min-w-0">
        {assignments.length === 0 ? (
          <div className="rounded-xl border border-dashed p-6 text-center">
            <ClipboardCheckIcon className="mx-auto size-5 text-muted-foreground" />
            <p className="mt-3 font-medium">Noch keine Umfrageversion zugeordnet</p>
            <p className="mt-1 text-sm text-muted-foreground">Wählen Sie rechts eine veröffentlichte Version aus.</p>
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
                    {labels.get(assignment.survey_version_id) ?? `Version ${assignment.survey_version_id}`}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Zugeordnet am {dateFormatter.format(new Date(assignment.assigned_at))}
                  </p>
                </div>
                <Badge variant="secondary">Aktiv</Badge>
                {options ? (
                  <UnassignVersionDialog
                    clinicId={clinicId}
                    surveyVersionId={assignment.survey_version_id}
                    surveyVersionName={labels.get(assignment.survey_version_id) ?? "diese Umfrageversion"}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="rounded-xl border bg-muted/25 p-4">
        <p className="font-medium">Version zuordnen</p>
        <p className="mt-1 text-sm text-muted-foreground">Nur veröffentlichte Versionen können für Kampagnen verwendet werden.</p>
        {options === null ? (
          <p className="mt-5 text-sm text-muted-foreground">
            Sie können die Zuordnungen sehen, benötigen aber Zugriff auf den Umfragekatalog, um sie zu verwalten.
          </p>
        ) : assignableOptions.length === 0 ? (
          <p className="mt-5 text-sm text-muted-foreground">Es sind keine weiteren veröffentlichten Versionen verfügbar.</p>
        ) : (
          <form action={assignSurveyVersionAction.bind(null, clinicId)} className="mt-5">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="surveyVersionId">Veröffentlichte Version</FieldLabel>
                <NativeSelect id="surveyVersionId" name="surveyVersionId" className="w-full" required defaultValue="">
                  <NativeSelectOption value="" disabled>Version auswählen</NativeSelectOption>
                  {assignableOptions.map((option) => (
                    <NativeSelectOption key={option.id} value={option.id}>{option.label}</NativeSelectOption>
                  ))}
                </NativeSelect>
                <FieldDescription>Der spätere Kampagnenstart bindet exakt diese unveränderliche Version.</FieldDescription>
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
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending} className="w-full">
      <LinkIcon data-icon="inline-start" />
      {pending ? "Wird zugeordnet …" : "Version zuordnen"}
    </Button>
  );
}

function UnassignVersionDialog({
  clinicId,
  surveyVersionId,
  surveyVersionName,
}: {
  clinicId: string;
  surveyVersionId: string;
  surveyVersionName: string;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="ghost" size="icon-sm" />}>
        <Trash2Icon />
        <span className="sr-only">{surveyVersionName} entfernen</span>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia><Trash2Icon /></AlertDialogMedia>
          <AlertDialogTitle>Zuordnung aufheben?</AlertDialogTitle>
          <AlertDialogDescription>
            {surveyVersionName} steht anschließend nicht mehr für neue Kampagnen dieser Klinik bereit.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Abbrechen</AlertDialogCancel>
          <form action={unassignSurveyVersionAction.bind(null, clinicId)}>
            <input type="hidden" name="surveyVersionId" value={surveyVersionId} />
            <AlertDialogAction type="submit" variant="destructive">Zuordnung aufheben</AlertDialogAction>
          </form>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
