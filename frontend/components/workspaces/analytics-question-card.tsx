"use client";

import { useState } from "react";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  MessageSquareTextIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
} from "lucide-react";
import { AnalyticsBarChart } from "@/components/workspaces/analytics-bar-chart";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { CampaignAnalytics } from "@/lib/api/types";

type Question = CampaignAnalytics["questions"][number];
const TEXT_ANSWER_PREVIEW_COUNT = 5;

export function AnalyticsQuestionCard({ question }: { question: Question }) {
  if (question.question_type === "yes_no") return <YesNoCard question={question} />;
  if (question.question_type === "short_text" || question.question_type === "long_text") {
    return <TextCard question={question} />;
  }

  const data = [...question.choices, ...question.distribution];
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{question.title}</CardTitle>
        <CardDescription>{question.answer_count} Antworten</CardDescription>
      </CardHeader>
      <CardContent>
        {question.average !== null ? (
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Ø" value={question.average} />
            <Stat label="Median" value={question.median} />
            <Stat label="Minimum" value={question.minimum} />
            <Stat label="Maximum" value={question.maximum} />
          </div>
        ) : null}
        {question.earliest_date ? (
          <p className="mb-4 text-sm">Zeitraum: {question.earliest_date} – {question.latest_date}</p>
        ) : null}
        {data.length ? (
          <AnalyticsBarChart data={data} />
        ) : (
          <p className="text-sm text-muted-foreground">Keine auswertbaren Antworten vorhanden.</p>
        )}
      </CardContent>
    </Card>
  );
}

function YesNoCard({ question }: { question: Question }) {
  const yes = question.choices.find((item) => item.label === "Ja")?.count ?? 0;
  const no = question.choices.find((item) => item.label === "Nein")?.count ?? 0;
  const total = question.answer_count || 1;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="bg-secondary/50">
        <CardTitle className="text-lg">{question.title}</CardTitle>
        <CardDescription>{question.answer_count} Antworten</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
        <Outcome icon={<ThumbsUpIcon />} label="Ja" count={yes} percent={Math.round((yes / total) * 100)} />
        <Outcome icon={<ThumbsDownIcon />} label="Nein" count={no} percent={Math.round((no / total) * 100)} />
      </CardContent>
    </Card>
  );
}

function Outcome({ icon, label, count, percent }: { icon: React.ReactNode; label: string; count: number; percent: number }) {
  return (
    <div className="rounded-xl border p-4">
      <div className="flex items-center gap-2 text-sm font-medium">{icon}{label}</div>
      <p className="mt-4 text-3xl font-semibold">{percent}%</p>
      <p className="mt-1 text-sm text-muted-foreground">{count} Antworten</p>
    </div>
  );
}

function TextCard({ question }: { question: Question }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasMoreAnswers = question.text_answers.length > TEXT_ANSWER_PREVIEW_COUNT;
  const answers = isExpanded
    ? question.text_answers
    : question.text_answers.slice(0, TEXT_ANSWER_PREVIEW_COUNT);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <MessageSquareTextIcon className="size-5 text-primary" />
          <div>
            <CardTitle className="text-lg">{question.title}</CardTitle>
            <CardDescription>{question.answer_count} Antworten · Freitext</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {answers.length ? (
          <div className="flex flex-col gap-2">
            {answers.map((answer, index) => (
              <blockquote key={`${question.question_id}-${index}`} className="rounded-lg bg-muted p-3 text-sm">
                {answer}
              </blockquote>
            ))}
          </div>
        ) : (
          <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
            Keine Freitextantworten vorhanden.
          </p>
        )}

        {hasMoreAnswers ? (
          <Button variant="outline" size="sm" className="w-fit" onClick={() => setIsExpanded((value) => !value)}>
            {isExpanded ? <ChevronUpIcon data-icon="inline-start" /> : <ChevronDownIcon data-icon="inline-start" />}
            {isExpanded ? "Weniger anzeigen" : `Alle ${question.text_answers.length} Antworten anzeigen`}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-lg bg-muted p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">
        {value === null ? "—" : value.toLocaleString("de-DE", { maximumFractionDigits: 2 })}
      </p>
    </div>
  );
}
