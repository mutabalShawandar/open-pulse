import Link from "next/link";
import { ArrowLeftIcon, PencilIcon } from "lucide-react";
import { notFound } from "next/navigation";

import { updateClinicAction } from "@/app/(platform)/clinics/actions";
import { ClinicForm } from "@/components/clinics/clinic-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError } from "@/lib/api/client";
import { getAccessToken } from "@/lib/auth/session";
import { resolveClinicBySlug } from "@/lib/resolve-clinic";

function errorMessage(error: string | string[] | undefined) {
  if (error === "exists") return "Diese interne Kennung wird bereits von einer anderen Klinik verwendet.";
  if (error === "validation") return "Bitte prüfen Sie die Pflichtfelder und die Hausnummer.";
  if (error) return "Die Änderungen konnten nicht gespeichert werden. Bitte versuchen Sie es erneut.";
  return null;
}

async function loadClinic(clinicSlug: string) {
  const accessToken = await getAccessToken();
  if (!accessToken) notFound();

  try {
    return await resolveClinicBySlug(accessToken, clinicSlug);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
}

export default async function EditClinicPage({
  params,
  searchParams,
}: PageProps<"/clinics/[clinicId]/edit">) {
  const { clinicId: clinicSlug } = await params;
  const clinic = await loadClinic(clinicSlug);

  const error = errorMessage((await searchParams).error);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-7 sm:px-6 lg:px-10 lg:py-10">
      <Button
        nativeButton={false}
        variant="ghost"
        className="w-fit"
        render={<Link href={`/clinics/${clinicSlug}`} />}
      >
        <ArrowLeftIcon data-icon="inline-start" />
        Zur Klinik
      </Button>
      <section className="flex items-start gap-4">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/15">
          <PencilIcon className="size-6" />
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">Klinikprofil</p>
          <h1 className="mt-1 font-heading text-3xl font-semibold tracking-tight">Klinik bearbeiten</h1>
          <p className="mt-2 text-muted-foreground">{clinic.name}</p>
        </div>
      </section>
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Änderungen nicht gespeichert</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <Card>
        <CardHeader className="border-b">
          <CardTitle>Stammdaten bearbeiten</CardTitle>
          <CardDescription>Änderungen werden in der Historie der Klinik festgehalten.</CardDescription>
        </CardHeader>
        <CardContent className="pt-5">
          <ClinicForm
            action={updateClinicAction.bind(null, clinicSlug)}
            clinic={clinic}
            submitLabel="Änderungen speichern"
          />
        </CardContent>
      </Card>
    </div>
  );
}
