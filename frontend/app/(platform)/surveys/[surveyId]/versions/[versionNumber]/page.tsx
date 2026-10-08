import Link from "next/link";
import { ArrowLeftIcon, LockKeyholeIcon } from "lucide-react";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError, getPublishedSurveyVersion } from "@/lib/api/client";
import { getAccessToken } from "@/lib/auth/session";

export default async function PublishedVersionPage({
  params,
}: {
  params: Promise<{ surveyId: string; versionNumber: string }>;
}) {
  const { surveyId, versionNumber } = await params;
  const token = await getAccessToken();
  if (!token) notFound();
  const t = await getTranslations("surveys");
  const format = await getFormatter();
  const version = await getPublishedSurveyVersion(token, surveyId, Number(versionNumber)).catch((error: unknown) => {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  });
  const publishedAt = version.published_at ? format.dateTime(new Date(version.published_at), { dateStyle: "long", timeStyle: "short" }) : "—";
  return <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-7 sm:px-6 lg:px-10 lg:py-10"><Button nativeButton={false} variant="ghost" className="w-fit" render={<Link href={`/surveys/${surveyId}`} />}><ArrowLeftIcon data-icon="inline-start" />{t("versionPage.toSurvey")}</Button><header className="border-l-4 border-primary pl-5"><div className="flex items-center gap-2 text-sm font-medium text-primary"><LockKeyholeIcon className="size-4" />{t("versionPage.immutable")}</div><h1 className="mt-2 font-heading text-3xl font-semibold tracking-tight">{t("detail.version", { number: version.version_number ?? "" })}</h1><p className="mt-2 text-muted-foreground">{t("versionPage.publishedOn", { date: publishedAt })}</p></header><div className="flex flex-col gap-4">{version.sections.map((section, sectionIndex) => <Card key={section.id}><CardHeader><p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">{t("versionPage.section", { number: sectionIndex + 1 })}</p><CardTitle className="font-heading text-xl">{section.title}</CardTitle>{section.description ? <p className="text-sm text-muted-foreground">{section.description}</p> : null}</CardHeader><CardContent><ol className="flex flex-col gap-4">{section.questions.map((question, questionIndex) => <li key={question.id}><p className="font-medium">{questionIndex + 1}. {question.title}{question.is_required ? <span className="ml-1 text-destructive">*</span> : null}</p>{question.help_text ? <p className="mt-1 text-sm text-muted-foreground">{question.help_text}</p> : null}{question.options.length ? <ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground">{question.options.map((option) => <li key={option.id}>{option.label}</li>)}</ul> : null}{question.validations.length ? <p className="mt-2 text-xs text-muted-foreground">{t("versionPage.rules")}: {question.validations.map((rule) => `${rule.rule_type}: ${String(rule.rule_value.value)}`).join(" · ")}</p> : null}</li>)}</ol></CardContent></Card>)}</div></div>;
}
