import Link from "next/link";
import { ArrowLeftIcon, Building2Icon } from "lucide-react";

import { createClinicAction } from "@/app/(platform)/clinics/actions";
import { ClinicForm } from "@/components/clinics/clinic-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function errorMessage(error: string | string[] | undefined) {
  if (error === "exists") return "Diese interne Kennung wird bereits von einer anderen Klinik verwendet.";
  if (error === "validation") return "Bitte prüfen Sie die Pflichtfelder und die Hausnummer.";
  if (error) return "Die Klinik konnte nicht angelegt werden. Bitte versuchen Sie es erneut.";
  return null;
}

export default async function NewClinicPage({
  searchParams,
}: PageProps<"/clinics/new">) {
  const error = errorMessage((await searchParams).error);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-7 sm:px-6 lg:px-10 lg:py-10">
      <Button nativeButton={false} variant="ghost" className="w-fit" render={<Link href="/clinics" />}>
        <ArrowLeftIcon data-icon="inline-start" />
        Alle Kliniken
      </Button>
      <section className="flex items-start gap-4">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/15">
          <Building2Icon className="size-6" />
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">Organisation</p>
          <h1 className="mt-1 font-heading text-3xl font-semibold tracking-tight">Neue Klinik</h1>
          <p className="mt-2 text-muted-foreground">Legen Sie einen Klinikstandort für die Plattform an.</p>
        </div>
      </section>
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Klinik nicht angelegt</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <Card>
        <CardHeader className="border-b">
          <CardTitle>Stammdaten</CardTitle>
          <CardDescription>Name und interne Kennung werden für die Organisation der Plattform benötigt.</CardDescription>
        </CardHeader>
        <CardContent className="pt-5">
          <ClinicForm action={createClinicAction} submitLabel="Klinik anlegen" showLogoUrl={false} />
        </CardContent>
      </Card>
    </div>
  );
}
