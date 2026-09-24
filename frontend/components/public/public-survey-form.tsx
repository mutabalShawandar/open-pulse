"use client";

import { FormEvent, useMemo, useState } from "react";
import { CheckCircle2, Send, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Spinner } from "@/components/ui/spinner";
import type { PublicCampaign } from "@/lib/api/public";

type Question = PublicCampaign["sections"][number]["questions"][number];
type Answer = { text_value?: string; number_value?: number; date_value?: string; boolean_value?: boolean; option_ids?: string[]; other_text?: string };
type SubmissionState = "idle" | "sending" | "done" | "error" | "legal" | "required";

export function PublicSurveyForm({ campaign, slug }: { campaign: PublicCampaign; slug: string }) {
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [state, setState] = useState<SubmissionState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [legalAccepted, setLegalAccepted] = useState(false);
  const requiredCount = useMemo(() => campaign.sections.flatMap((section) => section.questions).filter((question) => question.is_required).length, [campaign]);
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "");

  function update(questionId: string, value: Answer) {
    setAnswers((current) => ({ ...current, [questionId]: { ...current[questionId], ...value } }));
    setState((current) => current === "required" || current === "error" ? "idle" : current);
    setErrorMessage(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!legalAccepted) return setState("legal");
    const questions = campaign.sections.flatMap((section) => section.questions);
    if (questions.some((question) => question.is_required && !hasAnswer(question, answers[question.id]))) return setState("required");
    if (!apiBaseUrl) {
      setErrorMessage("Die Umfrage ist derzeit nicht erreichbar. Bitte versuchen Sie es später erneut.");
      return setState("error");
    }
    setState("sending");
    try {
      let token = sessionStorage.getItem(`survey-session:${slug}`);
      if (!token) {
        const response = await fetch(`${apiBaseUrl}/api/v1/public/campaigns/${encodeURIComponent(slug)}/responses`, { method: "POST" });
        if (!response.ok) throw new Error(await responseErrorMessage(response));
        token = (await response.json() as { session_token: string }).session_token;
        sessionStorage.setItem(`survey-session:${slug}`, token);
      }
      const submittedAnswers = questions.flatMap((question) => {
        const answer = answers[question.id];
        return hasAnswer(question, answer) ? [{ question_id: question.id, ...answer, other_text: answer?.other_text?.trim() || undefined }] : [];
      });
      if (submittedAnswers.length) {
        const response = await fetch(`${apiBaseUrl}/api/v1/public/responses/${encodeURIComponent(token)}/answers`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answers: submittedAnswers }) });
        if (!response.ok) throw new Error(await responseErrorMessage(response));
      }
      const response = await fetch(`${apiBaseUrl}/api/v1/public/responses/${encodeURIComponent(token)}/complete`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ legal_accepted: true }) });
      if (!response.ok) throw new Error(await responseErrorMessage(response));
      sessionStorage.removeItem(`survey-session:${slug}`);
      setState("done");
    } catch (error) {
      setErrorMessage(error instanceof Error && error.message ? error.message : "Die Antworten konnten nicht übermittelt werden. Bitte versuchen Sie es erneut.");
      setState("error");
    }
  }

  if (state === "done") return <section className="rounded-2xl border border-primary/20 bg-primary/5 p-10 text-center"><CheckCircle2 className="mx-auto mb-4 size-10 text-primary" /><h2 className="text-2xl font-semibold">Vielen Dank für Ihre Rückmeldung.</h2><p className="mt-2 text-muted-foreground">Ihre Antworten wurden übermittelt.</p></section>;
  return <form className="flex flex-col gap-8" onSubmit={submit} noValidate>
    {campaign.sections.map((section, index) => <fieldset key={section.id} className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8"><legend className="px-2 text-xs font-semibold tracking-[0.16em] text-primary uppercase">Abschnitt {index + 1}</legend><h2 className="mt-1 text-2xl font-semibold">{section.title}</h2>{section.description ? <p className="mt-2 text-muted-foreground">{section.description}</p> : null}<div className="mt-8 flex flex-col gap-8">{section.questions.map((question) => <Question key={question.id} question={question} answer={answers[question.id]} onChange={(answer) => update(question.id, answer)} />)}</div></fieldset>)}
    {state === "error" ? <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{errorMessage ?? "Die Antworten konnten nicht übermittelt werden. Bitte versuchen Sie es erneut."}</p> : null}
    {state === "legal" ? <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">Bitte bestätigen Sie die Datenschutzerklärung und Teilnahmebedingungen, bevor Sie die Umfrage absenden.</p> : null}
    {state === "required" ? <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">Bitte beantworten Sie alle Pflichtfragen, bevor Sie die Umfrage absenden.</p> : null}
    <section className="rounded-2xl bg-secondary p-5"><label className="flex cursor-pointer items-start gap-3 text-sm leading-6"><Checkbox checked={legalAccepted} onCheckedChange={(checked) => { setLegalAccepted(checked === true); if (checked) setState("idle"); }} aria-invalid={state === "legal"} /><span>Ich habe die <a className="font-medium text-primary underline underline-offset-4" href="https://reintjes.de/datenschutz/" target="_blank" rel="noreferrer">Datenschutzerklärung</a> zur Kenntnis genommen und akzeptiere die <a className="font-medium text-primary underline underline-offset-4" href="https://reintjes.de/agb/" target="_blank" rel="noreferrer">Teilnahmebedingungen (AGB)</a>. Das <a className="font-medium text-primary underline underline-offset-4" href="https://reintjes.de/impressum/" target="_blank" rel="noreferrer">Impressum</a> habe ich zur Kenntnis genommen.</span></label><div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t pt-5"><p className="text-sm text-muted-foreground">{requiredCount} Pflichtfragen sind mit <span className="text-destructive">*</span> markiert.</p><Button type="submit" size="lg" disabled={state === "sending" || !legalAccepted} aria-busy={state === "sending"}>{state === "sending" ? <Spinner data-icon="inline-start" /> : <Send data-icon="inline-start" />}{state === "sending" ? "Wird übermittelt …" : "Umfrage absenden"}</Button></div></section>
  </form>;
}

function Question({ question, answer, onChange }: { question: Question; answer: Answer | undefined; onChange: (answer: Answer) => void }) {
  const common = { name: question.id };
  const choices = question.question_type === "single_choice" || question.question_type === "multiple_choice";
  return <div><label className="block font-medium">{question.title}{question.is_required ? <span className="ml-1 text-destructive">*</span> : null}</label>{question.help_text ? <p className="mt-1 text-sm text-muted-foreground">{question.help_text}</p> : null}<div className="mt-3">{choices ? <ChoiceInput question={question} answer={answer} onChange={onChange} /> : question.question_type === "yes_no" ? <div className="flex gap-3">{[[true, "Ja"], [false, "Nein"]].map(([value, label]) => <label key={String(value)} className="flex cursor-pointer items-center gap-2"><input {...common} type="radio" checked={answer?.boolean_value === value} onChange={() => onChange({ boolean_value: value as boolean })} />{label}</label>)}</div> : question.question_type === "rating" ? <RatingInput question={question} answer={answer} onChange={onChange} /> : question.question_type === "long_text" ? <textarea {...common} className="min-h-28 w-full rounded-lg border bg-background p-3" value={answer?.text_value ?? ""} onChange={(event) => onChange({ text_value: event.target.value })} /> : <ScalarInput question={question} answer={answer} onChange={onChange} />}</div></div>;
}

function ChoiceInput({ question, answer, onChange }: { question: Question; answer: Answer | undefined; onChange: (answer: Answer) => void }) {
  const isSingle = question.question_type === "single_choice";
  const otherSelected = answer?.other_text !== undefined;
  return <div className="grid gap-2">{question.options.map((option) => <label key={option.id} className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 hover:bg-muted"><input name={question.id} type={isSingle ? "radio" : "checkbox"} checked={isSingle ? answer?.option_ids?.[0] === option.id : answer?.option_ids?.includes(option.id) ?? false} onChange={(event) => onChange({ option_ids: isSingle ? [option.id] : event.target.checked ? [...(answer?.option_ids ?? []), option.id] : (answer?.option_ids ?? []).filter((id) => id !== option.id), other_text: isSingle ? undefined : answer?.other_text })} />{option.label}</label>)}{question.allow_other ? <div className="rounded-lg border p-3"><label className="flex cursor-pointer items-center gap-3"><input name={question.id} type={isSingle ? "radio" : "checkbox"} checked={otherSelected} onChange={(event) => onChange({ option_ids: isSingle && event.target.checked ? [] : answer?.option_ids, other_text: event.target.checked ? "" : undefined })} />Sonstiges</label>{otherSelected ? <input className="mt-3 h-11 w-full rounded-lg border bg-background px-3" aria-label="Sonstige Antwort" value={answer?.other_text ?? ""} onChange={(event) => onChange({ other_text: event.target.value })} /> : null}</div> : null}</div>;
}

function ScalarInput({ question, answer, onChange }: { question: Question; answer: Answer | undefined; onChange: (answer: Answer) => void }) {
  const type = question.question_type === "date" ? "date" : question.question_type === "number" ? "number" : "text";
  const value = question.question_type === "date" ? answer?.date_value ?? "" : question.question_type === "number" ? answer?.number_value ?? "" : answer?.text_value ?? "";
  const min = question.question_type === "number" ? question.validations.min_value?.value : question.question_type === "date" ? question.validations.min_date?.value : undefined;
  const max = question.question_type === "number" ? question.validations.max_value?.value : question.question_type === "date" ? question.validations.max_date?.value : undefined;
  return <input name={question.id} className="h-11 w-full rounded-lg border bg-background px-3" type={type} min={min} max={max} value={value} onChange={(event) => onChange(question.question_type === "date" ? { date_value: event.target.value || undefined } : question.question_type === "number" ? { number_value: event.target.value === "" ? undefined : event.target.valueAsNumber } : { text_value: event.target.value })} />;
}

function RatingInput({ question, answer, onChange }: { question: Question; answer: Answer | undefined; onChange: (answer: Answer) => void }) {
  const minimum = ratingBound(question, "min_value", 1);
  const maximum = Math.max(minimum, ratingBound(question, "max_value", 5));
  const [hoveredValue, setHoveredValue] = useState<number | null>(null);
  const selectedValue = answer?.number_value;
  const displayedValue = hoveredValue ?? selectedValue ?? null;
  return <fieldset className="max-w-md" aria-required={question.is_required}><legend className="sr-only">{question.title}</legend><div className="flex flex-wrap gap-1.5" onMouseLeave={() => setHoveredValue(null)}>{Array.from({ length: maximum - minimum + 1 }, (_, index) => minimum + index).map((value) => <label key={value} className="group relative cursor-pointer" onMouseEnter={() => setHoveredValue(value)}><input name={question.id} type="radio" value={value} checked={selectedValue === value} onChange={() => onChange({ number_value: value })} onFocus={() => setHoveredValue(value)} onBlur={() => setHoveredValue(null)} className="peer sr-only" /><Star aria-hidden="true" className={`size-10 transition-[color,transform] duration-150 sm:size-11 ${displayedValue !== null && value <= displayedValue ? "fill-amber-400 text-amber-500" : "fill-transparent text-muted-foreground/45"} group-hover:scale-110 peer-focus-visible:rounded-sm peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary`} strokeWidth={1.8} /><span className="sr-only">Bewertung {value} auswählen</span></label>)}</div><div className="mt-2 flex items-center justify-between text-xs font-medium text-muted-foreground"><span>{minimum}</span><span>{selectedValue === undefined ? `Skala von ${minimum} bis ${maximum}` : `${selectedValue} von ${maximum}`}</span><span>{maximum}</span></div></fieldset>;
}

function ratingBound(question: Question, rule: "min_value" | "max_value", fallback: number) { const candidate = Number(question.validations[rule]?.value); return Number.isInteger(candidate) ? candidate : fallback; }
function hasAnswer(question: Question, answer: Answer | undefined) { if (!answer) return false; if (question.question_type === "single_choice" || question.question_type === "multiple_choice") return (answer.option_ids?.length ?? 0) > 0 || Boolean(answer.other_text?.trim()); if (question.question_type === "yes_no") return answer.boolean_value !== undefined; if (question.question_type === "rating" || question.question_type === "number") return Number.isFinite(answer.number_value); if (question.question_type === "date") return Boolean(answer.date_value); return Boolean(answer.text_value?.trim()); }

async function responseErrorMessage(response: Response) {
  if (response.status === 429) return "Zu viele Anfragen. Bitte warten Sie einen Moment und versuchen Sie es erneut.";
  if (response.status === 409) return "Diese Umfrage wurde bereits abgeschlossen.";
  try { const detail = (await response.json() as { detail?: unknown }).detail; const messages: Record<string, string> = { "Choice question requires selected options": "Bitte wählen Sie mindestens eine Antwort aus oder geben Sie eine sonstige Antwort ein.", "Too few options selected": "Bitte wählen Sie mehr Antworten aus.", "Too many options selected": "Sie haben zu viele Antworten ausgewählt.", "Numeric answer is below the permitted range": "Eine Zahl liegt unter dem erlaubten Mindestwert.", "Numeric answer is above the permitted range": "Eine Zahl liegt über dem erlaubten Höchstwert.", "Date answer is before the permitted range": "Ein Datum liegt vor dem erlaubten Zeitraum.", "Date answer is after the permitted range": "Ein Datum liegt nach dem erlaubten Zeitraum.", "Required questions are missing": "Bitte beantworten Sie alle Pflichtfragen." }; return typeof detail === "string" ? messages[detail] ?? "Bitte prüfen Sie Ihre Eingaben und versuchen Sie es erneut." : "Bitte prüfen Sie Ihre Eingaben und versuchen Sie es erneut."; } catch { return "Die Antworten konnten nicht übermittelt werden. Bitte versuchen Sie es erneut."; }
}
