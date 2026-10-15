import Link from "next/link";
import { ArrowLeftIcon, PencilIcon } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { updateWorkspaceAction } from "@/app/(platform)/workspaces/actions";
import { WorkspaceForm } from "@/components/workspaces/workspace-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError } from "@/lib/api/client";
import { getAccessToken } from "@/lib/auth/session";
import { resolveWorkspaceBySlug } from "@/lib/resolve-workspace";

function errorKey(error: string | string[] | undefined) {
  if (error === "exists") return "errors.exists";
  if (error === "validation") return "errors.validation";
  if (error) return "errors.saveUnknown";
  return null;
}

async function loadWorkspace(workspaceSlug: string) {
  const accessToken = await getAccessToken();
  if (!accessToken) notFound();

  try {
    return await resolveWorkspaceBySlug(accessToken, workspaceSlug);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
}

export default async function EditWorkspacePage({
  params,
  searchParams,
}: PageProps<"/workspaces/[workspaceId]/edit">) {
  const { workspaceId: workspaceSlug } = await params;
  const workspace = await loadWorkspace(workspaceSlug);

  const t = await getTranslations("workspaces");
  const key = errorKey((await searchParams).error);
  const error = key ? t(key) : null;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-7 sm:px-6 lg:px-10 lg:py-10">
      <Button
        nativeButton={false}
        variant="ghost"
        className="w-fit"
        render={<Link href={`/workspaces/${workspaceSlug}`} />}
      >
        <ArrowLeftIcon data-icon="inline-start" />
        {t("toWorkspace")}
      </Button>
      <section className="flex items-start gap-4">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/15">
          <PencilIcon className="size-6" />
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">{t("profile")}</p>
          <h1 className="mt-1 font-heading text-3xl font-semibold tracking-tight">{t("editTitle")}</h1>
          <p className="mt-2 text-muted-foreground">{workspace.name}</p>
        </div>
      </section>
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>{t("saveFailedTitle")}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <Card>
        <CardHeader className="border-b">
          <CardTitle>{t("editMasterData")}</CardTitle>
          <CardDescription>{t("editHint")}</CardDescription>
        </CardHeader>
        <CardContent className="pt-5">
          <WorkspaceForm
            action={updateWorkspaceAction.bind(null, workspaceSlug)}
            workspace={workspace}
            submitLabel={t("saveChanges")}
          />
        </CardContent>
      </Card>
    </div>
  );
}
