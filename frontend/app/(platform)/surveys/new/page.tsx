import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { createSurveyAction } from "@/app/(platform)/surveys/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
export default async function NewSurveyPage() { return <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-7 sm:px-6 lg:px-10 lg:py-10"><Button nativeButton={false} variant="ghost" className="w-fit" render={<Link href="/surveys" />}><ArrowLeftIcon data-icon="inline-start" />Alle Umfragen</Button><section><p className="text-sm font-medium text-muted-foreground">Umfragekatalog</p><h1 className="mt-2 font-heading text-3xl font-semibold tracking-tight">Neue Umfrage</h1></section><Card><CardHeader><CardTitle>Grundlage anlegen</CardTitle><CardDescription>Die Umfrage startet als bearbeitbarer Entwurf.</CardDescription></CardHeader><CardContent><form action={createSurveyAction}><FieldGroup><Field><FieldLabel htmlFor="title">Titel</FieldLabel><Input id="title" name="title" required /></Field><Field><FieldLabel htmlFor="description">Beschreibung</FieldLabel><Textarea id="description" name="description" /></Field><Field><FieldLabel htmlFor="draftLabel">Entwurfsbezeichnung</FieldLabel><Input id="draftLabel" name="draftLabel" placeholder="z. B. Erste Fassung" /></Field><Button type="submit">Umfrage anlegen</Button></FieldGroup></form></CardContent></Card></div>; }
