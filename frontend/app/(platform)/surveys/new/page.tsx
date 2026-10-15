import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { createSurveyAction } from "@/app/(platform)/surveys/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
export default async function NewSurveyPage() { const t = await getTranslations("surveys"); return <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-7 sm:px-6 lg:px-10 lg:py-10"><Button nativeButton={false} variant="ghost" className="w-fit" render={<Link href="/surveys" />}><ArrowLeftIcon data-icon="inline-start" />{t("new.all")}</Button><section><p className="text-sm font-medium text-muted-foreground">{t("list.eyebrow")}</p><h1 className="mt-2 font-heading text-3xl font-semibold tracking-tight">{t("new.title")}</h1></section><Card><CardHeader><CardTitle>{t("new.cardTitle")}</CardTitle><CardDescription>{t("new.cardDescription")}</CardDescription></CardHeader><CardContent><form action={createSurveyAction}><FieldGroup><Field><FieldLabel htmlFor="title">{t("new.fTitle")}</FieldLabel><Input id="title" name="title" required /></Field><Field><FieldLabel htmlFor="description">{t("new.fDescription")}</FieldLabel><Textarea id="description" name="description" /></Field><Field><FieldLabel htmlFor="draftLabel">{t("new.fDraftLabel")}</FieldLabel><Input id="draftLabel" name="draftLabel" placeholder={t("new.fDraftPlaceholder")} /></Field><Button type="submit">{t("new.submit")}</Button></FieldGroup></form></CardContent></Card></div>; }
