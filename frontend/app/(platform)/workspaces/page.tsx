import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Building2Icon, ChevronRightIcon, MapPinIcon, PlusIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { listWorkspaces } from "@/lib/api/client";
import { getAccessToken } from "@/lib/auth/session";
import { getRequestOrganization } from "@/lib/auth/request-organization";

function workspaceLocation(workspace: { postal_code: string | null; city: string | null }) {
  return [workspace.postal_code, workspace.city].filter(Boolean).join(" ");
}

export default async function WorkspacesPage() {
  const t = await getTranslations("workspaces");
  const accessToken = await getAccessToken();
  const allWorkspaces = accessToken ? await listWorkspaces(accessToken) : [];
  // GET /api/v1/workspaces is not org-scoped server-side (it lists every workspace
  // the platform user can see); on an "app.{org-slug}.{root}" host, narrow it
  // to that organization here so an org subdomain only shows its own workspaces.
  const organization = await getRequestOrganization();
  const workspaces = organization ? allWorkspaces.filter((workspace) => workspace.organization_id === organization.id) : allWorkspaces;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-7 sm:px-6 lg:px-10 lg:py-10">
      <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{t("eyebrow")}</p>
          <h1 className="mt-2 font-heading text-3xl font-semibold tracking-tight">{t("listTitle")}</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            {t("listIntro")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary">{t("total", { count: workspaces.length })}</Badge>
          <Button nativeButton={false} render={<Link href="/workspaces/new" />}>
            <PlusIcon data-icon="inline-start" />
            {t("new")}
          </Button>
        </div>
      </section>

      {workspaces.length === 0 ? (
        <Empty className="min-h-72 border bg-card">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Building2Icon />
            </EmptyMedia>
            <EmptyTitle>{t("emptyTitle")}</EmptyTitle>
            <EmptyDescription>
              {t("emptyDescription")}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {workspaces.map((workspace) => {
            const location = workspaceLocation(workspace);

            return (
              <Link key={workspace.id} href={`/workspaces/${workspace.slug}`} className="group block">
                <Card className="h-full transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:ring-primary/35">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      {workspace.logo_url ? (
                        <img src={workspace.logo_url} alt={t("logoAlt", { name: workspace.name })} className="size-10 rounded-xl bg-white object-contain p-1 ring-1 ring-border" />
                      ) : (
                        <div className="flex size-10 items-center justify-center rounded-xl bg-secondary text-secondary-foreground">
                          <Building2Icon className="size-5" />
                        </div>
                      )}
                      <ChevronRightIcon className="mt-1 size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
                    </div>
                    <CardTitle className="mt-5">{workspace.name}</CardTitle>
                    <CardDescription>/{workspace.slug}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {location ? (
                      <p className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPinIcon className="size-4" />
                        {location}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">{t("locationPending")}</p>
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
