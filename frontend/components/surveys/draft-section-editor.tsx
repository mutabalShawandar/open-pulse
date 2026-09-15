"use client";

import { useState } from "react";

import { ArrowDownIcon, ArrowUpIcon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  createOptionAction,
  createQuestionAction,
  createSectionAction,
  deleteQuestionAction,
  deleteOptionAction,
  deleteSectionAction,
  moveSectionAction,
  updateQuestionAction,
  updateSectionAction,
} from "@/app/(platform)/surveys/draft-actions";
import type { SurveyQuestionDetail, SurveySectionDetail } from "@/lib/api/types";

const questionTypes = [
  ["short_text", "Kurzantwort"],
  ["long_text", "Langer Text"],
  ["single_choice", "Einfachauswahl"],
  ["multiple_choice", "Mehrfachauswahl"],
  ["yes_no", "Ja / Nein"],
  ["rating", "Bewertung"],
  ["number", "Zahl"],
  ["date", "Datum"],
] as const;

type Props = {
  surveyId: string;
  draftId: string;
  sections: SurveySectionDetail[];
};

export function DraftSectionEditor({ surveyId, draftId, sections }: Props) {
  const sectionIds = sections.map((section) => section.id).join(",");

  return (
    <div className="flex flex-col gap-5">
      <Card className="border-primary/20 bg-primary/[0.025]">
        <CardHeader>
          <CardTitle className="font-heading">Abschnitt hinzufügen</CardTitle>
          <CardDescription>Gliedere die Befragung in verständliche Themenblöcke.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createSectionAction.bind(null, surveyId, draftId)}>
            <FieldGroup>
              <Field><FieldLabel htmlFor="new-section-title">Titel</FieldLabel><Input id="new-section-title" name="title" placeholder="z. B. Ihr Besuch" required /></Field>
              <Field><FieldLabel htmlFor="new-section-description">Einleitung <span className="text-muted-foreground">(optional)</span></FieldLabel><Textarea id="new-section-description" name="description" placeholder="Worum geht es in diesem Abschnitt?" rows={2} /></Field>
              <Button type="submit" className="w-fit"><PlusIcon data-icon="inline-start" />Abschnitt hinzufügen</Button>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>

      {sections.length ? <ol className="flex flex-col gap-3">{sections.map((section, index) => (
        <li key={section.id}>
          <Card>
            <CardHeader className="gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1.5"><p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">Abschnitt {index + 1}</p><CardTitle className="font-heading text-xl">{section.title}</CardTitle>{section.description ? <CardDescription>{section.description}</CardDescription> : null}</div>
              <div className="flex items-center gap-1">
                <form action={moveSectionAction.bind(null, surveyId, draftId)}><input type="hidden" name="sectionIds" value={sectionIds} /><input type="hidden" name="sectionId" value={section.id} /><input type="hidden" name="direction" value="up" /><Button type="submit" variant="ghost" size="icon-sm" disabled={index === 0} aria-label="Abschnitt nach oben verschieben"><ArrowUpIcon /></Button></form>
                <form action={moveSectionAction.bind(null, surveyId, draftId)}><input type="hidden" name="sectionIds" value={sectionIds} /><input type="hidden" name="sectionId" value={section.id} /><input type="hidden" name="direction" value="down" /><Button type="submit" variant="ghost" size="icon-sm" disabled={index === sections.length - 1} aria-label="Abschnitt nach unten verschieben"><ArrowDownIcon /></Button></form>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <QuestionList surveyId={surveyId} draftId={draftId} sectionId={section.id} questions={section.questions} />
              <details className="rounded-lg border bg-muted/20 p-4"><summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-medium"><PlusIcon className="size-4" />Frage hinzufügen</summary><QuestionForm action={createQuestionAction.bind(null, surveyId, draftId, section.id)} /></details>
              <div className="flex flex-wrap gap-2 border-t pt-4">
                <details><summary className="flex w-fit cursor-pointer list-none items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"><PencilIcon className="size-4" />Abschnitt bearbeiten</summary><form action={updateSectionAction.bind(null, surveyId, draftId, section.id)} className="mt-3 w-full min-w-72 rounded-lg border bg-muted/25 p-4"><FieldGroup><Field><FieldLabel htmlFor={`section-title-${section.id}`}>Titel</FieldLabel><Input id={`section-title-${section.id}`} name="title" defaultValue={section.title} required /></Field><Field><FieldLabel htmlFor={`section-description-${section.id}`}>Einleitung</FieldLabel><Textarea id={`section-description-${section.id}`} name="description" defaultValue={section.description ?? ""} rows={2} /></Field><Button type="submit" className="w-fit">Änderungen speichern</Button></FieldGroup></form></details>
                <AlertDialog><AlertDialogTrigger render={<Button variant="ghost" className="text-destructive hover:text-destructive" />}><Trash2Icon data-icon="inline-start" />Abschnitt löschen</AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Abschnitt löschen?</AlertDialogTitle><AlertDialogDescription>Der Abschnitt und seine enthaltenen Fragen werden unwiderruflich aus diesem Entwurf entfernt.</AlertDialogDescription></AlertDialogHeader><form action={deleteSectionAction.bind(null, surveyId, draftId, section.id)}><AlertDialogFooter><AlertDialogCancel>Abbrechen</AlertDialogCancel><AlertDialogAction type="submit" variant="destructive">Löschen</AlertDialogAction></AlertDialogFooter></form></AlertDialogContent></AlertDialog>
              </div>
            </CardContent>
          </Card>
        </li>
      ))}</ol> : <div className="rounded-xl border border-dashed px-6 py-12 text-center"><p className="font-heading text-lg font-medium">Noch keine Abschnitte</p><p className="mt-1 text-sm text-muted-foreground">Lege den ersten Themenblock an, um Fragen darin zu organisieren.</p></div>}
    </div>
  );
}

function QuestionList({ surveyId, draftId, sectionId, questions }: { surveyId: string; draftId: string; sectionId: string; questions: SurveyQuestionDetail[] }) {
  if (!questions.length) return <p className="rounded-lg border border-dashed px-4 py-5 text-sm text-muted-foreground">In diesem Abschnitt sind noch keine Fragen.</p>;
  return <ol className="flex flex-col gap-2">{questions.map((question, index) => <li key={question.id} className="rounded-lg border p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-medium text-muted-foreground">Frage {index + 1} · {questionTypes.find(([value]) => value === question.question_type)?.[1]}</p><p className="mt-1 font-medium">{question.title}{question.is_required ? <span className="ml-1 text-destructive">*</span> : null}</p>{question.help_text ? <p className="mt-1 text-sm text-muted-foreground">{question.help_text}</p> : null}</div><AlertDialog><AlertDialogTrigger render={<Button variant="ghost" size="icon-sm" className="text-destructive hover:text-destructive" aria-label="Frage löschen" />}><Trash2Icon /></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Frage löschen?</AlertDialogTitle><AlertDialogDescription>Diese Frage wird unwiderruflich aus dem Entwurf entfernt.</AlertDialogDescription></AlertDialogHeader><form action={deleteQuestionAction.bind(null, surveyId, draftId, sectionId, question.id)}><AlertDialogFooter><AlertDialogCancel>Abbrechen</AlertDialogCancel><AlertDialogAction type="submit" variant="destructive">Löschen</AlertDialogAction></AlertDialogFooter></form></AlertDialogContent></AlertDialog></div><details className="mt-3"><summary className="flex w-fit cursor-pointer list-none items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"><PencilIcon className="size-4" />Frage bearbeiten</summary><QuestionForm action={updateQuestionAction.bind(null, surveyId, draftId, sectionId, question.id)} question={question} /></details></li>)}</ol>;
}

export function ChoiceOptions({ surveyId, draftId, sectionId, question }: { surveyId: string; draftId: string; sectionId: string; question: SurveyQuestionDetail }) {
  if (question.question_type !== "single_choice" && question.question_type !== "multiple_choice") return null;
  return <div className="mt-3 rounded-md bg-muted/40 p-3"><p className="text-sm font-medium">Antwortoptionen</p><div className="mt-2 flex flex-col gap-2">{question.options.map((option) => <div key={option.id} className="flex items-center justify-between gap-2 text-sm"><span>{option.label}</span><form action={deleteOptionAction.bind(null, surveyId, draftId, sectionId, question.id, option.id)}><Button type="submit" variant="ghost" size="icon-sm" aria-label="Option löschen"><Trash2Icon /></Button></form></div>)}</div><form action={createOptionAction.bind(null, surveyId, draftId, sectionId, question.id)} className="mt-3 flex gap-2"><Input name="optionLabel" placeholder="Antwortoption" required /><Button type="submit" size="sm">Option hinzufügen</Button></form></div>;
}

function QuestionForm({ action, question }: { action: (formData: FormData) => void | Promise<void>; question?: SurveyQuestionDetail }) {
  const [type, setType] = useState(question?.question_type ?? "short_text");
  const supportsOther = type === "single_choice" || type === "multiple_choice";
  return <form action={action} className="mt-4"><FieldGroup><Field>{!question ? <><FieldLabel htmlFor="question-type">Fragetyp</FieldLabel><select id="question-type" name="questionType" value={type} onChange={(event) => setType(event.target.value as typeof type)} className="h-9 w-full rounded-md border bg-background px-3 text-sm">{questionTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></> : null}</Field><Field><FieldLabel htmlFor={question ? `question-title-${question.id}` : "question-title"}>Frage</FieldLabel><Input id={question ? `question-title-${question.id}` : "question-title"} name="title" defaultValue={question?.title} placeholder="Wie zufrieden waren Sie?" required /></Field><Field><FieldLabel htmlFor={question ? `question-help-${question.id}` : "question-help"}>Hinweis <span className="text-muted-foreground">(optional)</span></FieldLabel><Textarea id={question ? `question-help-${question.id}` : "question-help"} name="helpText" defaultValue={question?.help_text ?? ""} rows={2} /></Field><label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" name="isRequired" defaultChecked={question?.is_required} />Pflichtfrage</label>{supportsOther ? <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" name="allowOther" defaultChecked={question?.allow_other} />Sonstiges mit Freitext erlauben</label> : null}<Button type="submit" className="w-fit">{question ? "Frage speichern" : "Frage hinzufügen"}</Button></FieldGroup></form>;
}
