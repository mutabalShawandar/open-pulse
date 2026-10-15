import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowLeftIcon, Building2Icon } from "lucide-react";

import { createWorkspaceAction } from "@/app/(platform)/workspaces/actions";
import { WorkspaceForm } from "@/components/workspaces/workspace-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function errorKey(error: string | string[] | undefined) {
  if (error === "exists") return "errors.exists";
  if (error === "validation") return "errors.validation";
  if (error) return "errors.createUnknown";
  return null;
}

export default async function NewWorkspacePage({
  searchParams,
}: PageProps<"/workspaces/new">) {
  const t = await getTranslations("workspaces");
  const key = errorKey((await searchParams).error);
  const error = key ? t(key) : null;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-7 sm:px-6 lg:px-10 lg:py-10">
      <Button nativeButton={false} variant="ghost" className="w-fit" render={<Link href="/workspaces" />}>
        <ArrowLeftIcon data-icon="inline-start" />
        {t("allWorkspaces")}
      </Button>
      <section className="flex items-start gap-4">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/15">
          <Building2Icon className="size-6" />
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">{t("eyebrow")}</p>
          <h1 className="mt-1 font-heading text-3xl font-semibold tracking-tight">{t("newTitle")}</h1>
          <p className="mt-2 text-muted-foreground">{t("newIntro")}</p>
        </div>
      </section>
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>{t("createFailedTitle")}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <Card>
        <CardHeader className="border-b">
          <CardTitle>{t("masterData")}</CardTitle>
          <CardDescription>{t("masterDataHint")}</CardDescription>
        </CardHeader>
        <CardContent className="pt-5">
          <WorkspaceForm action={createWorkspaceAction} submitLabel={t("create")} />
        </CardContent>
      </Card>
    </div>
  );
}
