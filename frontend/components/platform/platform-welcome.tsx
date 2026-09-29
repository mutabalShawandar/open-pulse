import Link from "next/link";
import { ArrowRightIcon, Building2Icon, ClipboardListIcon, ShieldCheckIcon } from "lucide-react";

import type { Workspace, CurrentUser, Survey } from "@/lib/api/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { userDisplayName } from "@/lib/user-display";

export function PlatformWelcome({ workspaces, surveys, user }: { workspaces: Workspace[]; surveys: Survey[]; user: CurrentUser }) {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-7 sm:px-6 lg:px-10 lg:py-10">
      <section>
        <p className="text-sm font-medium text-muted-foreground">Arbeitsbereich</p>
        <h1 className="mt-2 font-heading text-3xl font-semibold tracking-tight">
          Willkommen, {userDisplayName(user)}.
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Verwalten Sie Kliniken und die ihnen zugeordneten Umfragen an einem Ort.
        </p>
      </section>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(18rem,1fr)]">
        <Card className="border-primary/20 bg-[linear-gradient(135deg,color-mix(in_oklch,var(--card),var(--primary)_5%),var(--card))]">
          <CardHeader>
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Building2Icon className="size-5" />
            </div>
            <CardTitle className="mt-3">Kliniken im Blick</CardTitle>
            <CardDescription>
              Stammdaten und Umfragezuordnungen werden pro Klinik gepflegt.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-end justify-between gap-4">
            <div>
              <p className="font-heading text-4xl font-semibold tracking-tight">{workspaces.length}</p>
              <p className="mt-1 text-sm text-muted-foreground">verfügbare Kliniken</p>
            </div>
            <Button nativeButton={false} render={<Link href="/workspaces" />}>
              Kliniken öffnen
              <ArrowRightIcon data-icon="inline-end" />
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <ShieldCheckIcon className="size-6 text-primary" />
            <CardTitle className="mt-3">Plattformzugang aktiv</CardTitle>
            <CardDescription>
              Ihre Identität und Ihr aktiver Plattformzugang wurden geprüft.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Badge variant="secondary">Sitzung verifiziert</Badge>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <div className="flex size-10 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
            <ClipboardListIcon className="size-5" />
          </div>
          <CardTitle className="mt-3">Umfragekatalog</CardTitle>
          <CardDescription>Erstellen, pflegen und veröffentlichen Sie wiederverwendbare Umfragen.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-end justify-between gap-4">
          <div><p className="font-heading text-4xl font-semibold tracking-tight">{surveys.length}</p><p className="mt-1 text-sm text-muted-foreground">davon {surveys.filter((survey) => survey.status === "published").length} veröffentlicht</p></div>
          <Button nativeButton={false} render={<Link href="/surveys" />}>Umfragen öffnen<ArrowRightIcon data-icon="inline-end" /></Button>
        </CardContent>
      </Card>
    </div>
  );
}
