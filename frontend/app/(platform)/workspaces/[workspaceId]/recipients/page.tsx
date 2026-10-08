import Link from "next/link";
import { ArrowLeftIcon, UsersRoundIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { OptOutRecipientDialog } from "@/components/workspaces/opt-out-recipient-dialog";
import { RecipientImportForm } from "@/components/campaigns/recipient-import-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { importWorkspaceRecipientsAction, optOutWorkspaceRecipientAction } from "../../actions";
import { listRecipients } from "@/lib/api/client";
import { getAccessToken } from "@/lib/auth/session";
import { resolveWorkspaceBySlug } from "@/lib/resolve-workspace";

export default async function WorkspaceRecipientsPage({ params, searchParams }: { params: Promise<{ workspaceId: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { workspaceId: workspaceSlug } = await params;
  const query = await searchParams;
  const t = await getTranslations("recipients");
  const token = await getAccessToken();
  if (!token) return null;
  const workspace = await resolveWorkspaceBySlug(token, workspaceSlug);
  const recipients = await listRecipients(token, workspace.id);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-7 sm:px-6 lg:px-10 lg:py-10">
      <div>
        <Button nativeButton={false} variant="ghost" render={<Link href={`/workspaces/${workspaceSlug}`} />}><ArrowLeftIcon data-icon="inline-start" /> {t("back")}</Button>
        <div className="mt-4 flex items-start gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-secondary text-secondary-foreground"><UsersRoundIcon className="size-5" /></div>
          <div><p className="text-sm font-medium text-muted-foreground">{workspace.name}</p><h1 className="font-heading text-3xl font-semibold tracking-tight">{t("title")}</h1></div>
        </div>
      </div>

      {query.created ? <div className="rounded-md border border-primary/30 bg-primary/5 px-4 py-3 text-sm">{t("imported", { created: query.created, duplicates: query.duplicates ?? 0 })}</div> : null}
      {query.optedOut ? <div className="rounded-md border border-primary/30 bg-primary/5 px-4 py-3 text-sm">{t("optedOut")}</div> : null}
      {query.error ? <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">{t("error")}</div> : null}

      <Card>
        <CardHeader><CardTitle>{t("addTitle")}</CardTitle><CardDescription>{t("addHint")}</CardDescription></CardHeader>
        <CardContent><RecipientImportForm action={importWorkspaceRecipientsAction.bind(null, workspaceSlug)} submitLabel={t("save")} /></CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>{t("savedTitle", { count: recipients.length })}</CardTitle><CardDescription>{t("savedHint")}</CardDescription></CardHeader>
        <CardContent className="flex flex-col gap-2">
          {recipients.length ? recipients.map((recipient) => (
            <div key={recipient.id} className="flex flex-col gap-2 rounded-lg border px-3 py-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{recipient.display_name || t("noName")}</p><p className="truncate text-sm text-muted-foreground">{recipient.email}</p></div>
              <Badge variant={recipient.status === "active" ? "secondary" : "outline"}>{recipient.status === "active" ? t("status.active") : recipient.status === "opted_out" ? t("status.opted_out") : t("status.bounced")}</Badge>
              {recipient.status === "active" ? <OptOutRecipientDialog recipientName={recipient.display_name || recipient.email} action={optOutWorkspaceRecipientAction.bind(null, workspaceSlug, recipient.id)} /> : null}
            </div>
          )) : <p className="py-6 text-sm text-muted-foreground">{t("none")}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
