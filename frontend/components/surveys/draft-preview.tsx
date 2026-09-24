"use client";

import { EyeIcon, SendIcon, StarIcon } from "lucide-react";

import { publishDraftAction } from "@/app/(platform)/surveys/draft-actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { SurveySectionDetail } from "@/lib/api/types";

export function DraftPreview({ surveyId, draftId, title, sections }: { surveyId: string; draftId: string; title: string; sections: SurveySectionDetail[] }) {
  return <div className="flex flex-wrap gap-2">
    <Dialog><DialogTrigger render={<Button variant="outline" />}><EyeIcon data-icon="inline-start" />Vorschau</DialogTrigger><DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto p-0"><DialogHeader className="border-b px-6 py-5"><DialogTitle>{title}</DialogTitle><DialogDescription>Vorschau aus Sicht der befragten Person. Antworten werden nicht gespeichert.</DialogDescription></DialogHeader><div className="flex flex-col gap-8 px-6 py-5">{sections.map((section, index) => <section key={section.id}><p className="text-xs font-medium tracking-[0.16em] text-primary uppercase">Abschnitt {index + 1}</p><h2 className="mt-1 font-heading text-xl font-semibold">{section.title}</h2>{section.description ? <p className="mt-2 text-sm text-muted-foreground">{section.description}</p> : null}<div className="mt-5 flex flex-col gap-5">{section.questions.map((question) => <div key={question.id}><p className="font-medium">{question.title}{question.is_required ? <span className="ml-1 text-destructive">*</span> : null}</p>{question.help_text ? <p className="mt-1 text-sm text-muted-foreground">{question.help_text}</p> : null}<PreviewInput question={question} /></div>)}</div></section>)}{!sections.length ? <p className="text-sm text-muted-foreground">Dieser Entwurf enthält noch keine Abschnitte.</p> : null}</div><DialogFooter><DialogClose render={<Button variant="outline" />}>Schließen</DialogClose></DialogFooter></DialogContent></Dialog>
    <Dialog><DialogTrigger render={<Button />}><SendIcon data-icon="inline-start" />Veröffentlichen</DialogTrigger><DialogContent><DialogHeader><DialogTitle>Entwurf veröffentlichen?</DialogTitle><DialogDescription>Die aktuelle Struktur wird als unveränderliche Version gespeichert. Änderungen sind danach nur über einen neuen Entwurf möglich.</DialogDescription></DialogHeader><DialogFooter><DialogClose render={<Button variant="outline" />}>Abbrechen</DialogClose><form action={publishDraftAction.bind(null, surveyId, draftId)}><Button type="submit"><SendIcon data-icon="inline-start" />Jetzt veröffentlichen</Button></form></DialogFooter></DialogContent></Dialog>
  </div>;
}

function PreviewInput({ question }: { question: SurveySectionDetail["questions"][number] }) {
  if (question.question_type === "rating") {
    const minimum = ratingBound(question, "min_value", 1);
    const maximum = Math.max(minimum, ratingBound(question, "max_value", 5));
    return <div className="mt-3 max-w-md"><div className="flex flex-wrap gap-1.5">{Array.from({ length: maximum - minimum + 1 }, (_, index) => <StarIcon key={minimum + index} aria-hidden="true" className="size-9 fill-muted text-muted-foreground/50" strokeWidth={1.8} />)}</div><div className="mt-2 flex justify-between text-xs font-medium text-muted-foreground"><span>{minimum}</span><span>Skala von {minimum} bis {maximum}</span><span>{maximum}</span></div></div>;
  }
  if (question.question_type === "long_text") return <textarea className="mt-2 min-h-24 w-full rounded-md border bg-muted/20 p-3 text-sm" disabled />;
  if (question.question_type === "single_choice" || question.question_type === "multiple_choice") return <div className="mt-3 flex flex-col gap-2">{question.options.map((option) => <label key={option.id} className="flex items-center gap-2 text-sm"><input type={question.question_type === "single_choice" ? "radio" : "checkbox"} disabled />{option.label}</label>)}</div>;
  if (question.question_type === "yes_no") return <div className="mt-3 flex gap-5 text-sm"><label><input type="radio" disabled /> Ja</label><label><input type="radio" disabled /> Nein</label></div>;
  return <input type={question.question_type === "date" ? "date" : question.question_type === "number" ? "number" : "text"} className="mt-2 h-10 w-full rounded-md border bg-muted/20 px-3 text-sm" disabled />;
}

function ratingBound(question: SurveySectionDetail["questions"][number], rule: "min_value" | "max_value", fallback: number) {
  const candidate = Number(question.validations.find((validation) => validation.rule_type === rule)?.rule_value.value);
  return Number.isInteger(candidate) ? candidate : fallback;
}
