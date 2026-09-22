import Link from "next/link";
import { Building2Icon, ChevronRightIcon, MapPinIcon, PlusIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { listClinics } from "@/lib/api/client";
import { getAccessToken } from "@/lib/auth/session";

function clinicLocation(clinic: { postal_code: string | null; city: string | null }) {
  return [clinic.postal_code, clinic.city].filter(Boolean).join(" ");
}

export default async function ClinicsPage() {
  const accessToken = await getAccessToken();
  const clinics = accessToken ? await listClinics(accessToken) : [];

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-7 sm:px-6 lg:px-10 lg:py-10">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Organisation</p>
          <h1 className="mt-2 font-heading text-3xl font-semibold tracking-tight">Kliniken</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Alle verfügbaren Klinikstandorte und ihre Plattformdaten.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary">{clinics.length} gesamt</Badge>
          <Button nativeButton={false} render={<Link href="/clinics/new" />}>
            <PlusIcon data-icon="inline-start" />
            Neue Klinik
          </Button>
        </div>
      </section>

      {clinics.length === 0 ? (
        <Empty className="min-h-72 border bg-card">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Building2Icon />
            </EmptyMedia>
            <EmptyTitle>Noch keine Kliniken verfügbar</EmptyTitle>
            <EmptyDescription>
              Sobald Kliniken für Ihren Zugriff eingerichtet sind, erscheinen sie hier.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {clinics.map((clinic) => {
            const location = clinicLocation(clinic);

            return (
              <Link key={clinic.id} href={`/clinics/${clinic.slug}`} className="group block">
                <Card className="h-full transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:ring-primary/35">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex size-10 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
                        <Building2Icon className="size-5" />
                      </div>
                      <ChevronRightIcon className="mt-1 size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                    </div>
                    <CardTitle className="mt-5">{clinic.name}</CardTitle>
                    <CardDescription>/{clinic.slug}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {location ? (
                      <p className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPinIcon className="size-4" />
                        {location}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">Standortdaten ausstehend</p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
