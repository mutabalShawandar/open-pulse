"use client";

import { FormEvent, useMemo, useState } from "react";
import { CheckCircle2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PublicCampaign } from "@/lib/api/public";

type Answer = { text_value?: string; number_value?: number; date_value?: string; boolean_value?: boolean; option_ids?: string[]; other_text?: string };

export function PublicSurveyForm({ campaign, slug }: { campaign: PublicCampaign; slug: string }) {
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const requiredCount = useMemo(() => campaign.sections.flatMap((section) => section.questions).filter((question) => question.is_required).length, [campaign]);
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "");

  function update(questionId: string, value: Answer) {
    setAnswers((current) => ({ ...current, [questionId]: { ...current[questionId], ...value } }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!apiBaseUrl) return;
    setState("sending");
    try {
      let token = sessionStorage.getItem(`survey-session:${slug}`);
      if (!token) {
        const started = await fetch(`${apiBaseUrl}/api/v1/public/campaigns/${encodeURIComponent(slug)}/responses`, { method: "POST" });
        if (!started.ok) throw new Error();
        token = (await started.json() as { session_token: string }).session_token;
        sessionStorage.setItem(`survey-session:${slug}`, token);
      }
      const submittedAnswers = Object.entries(answers).map(([question_id, answer]) => ({ question_id, ...answer }));
      if (submittedAnswers.length) {
        const saved = await fetch(`${apiBaseUrl}/api/v1/public/responses/${encodeURIComponent(token)}/answers`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answers: submittedAnswers }) });
        if (!saved.ok) throw new Error();
      }
      const completed = await fetch(`${apiBaseUrl}/api/v1/public/responses/${encodeURIComponent(token)}/complete`, { method: "POST" });
      if (!completed.ok) throw new Error();
      sessionStorage.removeItem(`survey-session:${slug}`);
      setState("done");
    } catch {
      setState("error");
    }
  }

  if (state === "done") return <section className="rounded-2xl border border-primary/20 bg-primary/5 p-10 text-center"><CheckCircle2 className="mx-auto mb-4 size-10 text-primary" /><h2 className="text-2xl font-semibold">Vielen Dank für Ihre Rückmeldung.</h2><p className="mt-2 text-muted-foreground">Ihre Antworten wurden übermittelt.</p></section>;

  return <form className="space-y-8" onSubmit={submit}>
    {campaign.sections.map((section, index) => <fieldset key={section.id} className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8"><legend className="px-2 text-xs font-semibold tracking-[0.16em] text-primary uppercase">Abschnitt {index + 1}</legend><h2 className="mt-1 text-2xl font-semibold">{section.title}</h2>{section.description && <p className="mt-2 text-muted-foreground">{section.description}</p>}<div className="mt-8 space-y-8">{section.questions.map((question) => <Question key={question.id} question={question} answer={answers[question.id]} onChange={(answer) => update(question.id, answer)} />)}</div></fieldset>)}
    {state === "error" && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">Die Antworten konnten nicht übermittelt werden. Bitte prüfen Sie Ihre Eingaben und versuchen Sie es erneut.</p>}
    <div className="flex items-center justify-between gap-4 rounded-2xl bg-secondary p-5"><p className="text-sm text-muted-foreground">{requiredCount} Pflichtfragen sind mit <span className="text-destructive">*</span> markiert.</p><Button type="submit" size="lg" disabled={state === "sending"}><Send data-icon="inline-start" />{state === "sending" ? "Wird übermittelt …" : "Umfrage absenden"}</Button></div>
  </form>;
}

function Question({ question, answer, onChange }: { question: PublicCampaign["sections"][number]["questions"][number]; answer: Answer | undefined; onChange: (answer: Answer) => void }) {
  const common = { required: question.is_required, name: question.id };
  const choices = question.question_type === "single_choice" || question.question_type === "multiple_choice";
  return <div><label className="block font-medium">{question.title}{question.is_required && <span className="ml-1 text-destructive">*</span>}</label>{question.help_text && <p className="mt-1 text-sm text-muted-foreground">{question.help_text}</p>}<div className="mt-3">{choices ? <div className="grid gap-2">{question.options.map((option) => <label key={option.id} className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 hover:bg-muted"><input {...common} type={question.question_type === "single_choice" ? "radio" : "checkbox"} checked={question.question_type === "single_choice" ? answer?.option_ids?.[0] === option.id : answer?.option_ids?.includes(option.id) ?? false} onChange={(event) => onChange({ option_ids: question.question_type === "single_choice" ? [option.id] : event.target.checked ? [...(answer?.option_ids ?? []), option.id] : (answer?.option_ids ?? []).filter((id) => id !== option.id) })} />{option.label}</label>)}</div> : question.question_type === "yes_no" ? <div className="flex gap-3">{[[true, "Ja"], [false, "Nein"]].map(([value, label]) => <label key={String(value)} className="flex cursor-pointer items-center gap-2"><input {...common} type="radio" checked={answer?.boolean_value === value} onChange={() => onChange({ boolean_value: value as boolean })} />{label}</label>)}</div> : question.question_type === "long_text" ? <textarea {...common} className="min-h-28 w-full rounded-lg border bg-background p-3" value={answer?.text_value ?? ""} onChange={(event) => onChange({ text_value: event.target.value })} /> : <input {...common} className="h-11 w-full rounded-lg border bg-background px-3" type={question.question_type === "date" ? "date" : question.question_type === "number" || question.question_type === "rating" ? "number" : "text"} value={question.question_type === "date" ? answer?.date_value ?? "" : question.question_type === "number" || question.question_type === "rating" ? answer?.number_value ?? "" : answer?.text_value ?? ""} onChange={(event) => onChange(question.question_type === "date" ? { date_value: event.target.value } : question.question_type === "number" || question.question_type === "rating" ? { number_value: event.target.valueAsNumber } : { text_value: event.target.value })} />}</div></div>;
}
