import { UsersRoundIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { CreateUserForm } from "@/components/administration/create-user-form";
import { DeactivateUserDialog } from "@/components/administration/deactivate-user-dialog";
import { PermanentlyDeleteUserDialog } from "@/components/administration/permanently-delete-user-dialog";
import { ReactivateUserButton } from "@/components/administration/reactivate-user-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listPlatformUsers } from "@/lib/api/client";
import { requireUser } from "@/lib/auth/require-user";
import { getAccessToken } from "@/lib/auth/session";

export default async function UsersPage({ searchParams }: PageProps<"/administration/users">) {
  const actor = await requireUser();
  const accessToken = await getAccessToken();
  if (!accessToken) return null;
  const users = await listPlatformUsers(accessToken);
  const query = await searchParams;
  const t = await getTranslations("admin");

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-7 sm:px-6 lg:px-10 lg:py-10">
      <section><p className="text-sm font-medium text-muted-foreground">{t("eyebrow")}</p><h1 className="mt-2 font-heading text-3xl font-semibold tracking-tight">{t("users.title")}</h1><p className="mt-2 text-muted-foreground">{t("users.intro")}</p></section>
      {query.created ? <Notice>{t("users.created")}</Notice> : null}
      {query.deactivated ? <Notice>{t("users.deactivated")}</Notice> : null}
      {query.reactivated ? <Notice>{t("users.reactivated")}</Notice> : null}
      {query.deleted ? <Notice>{t("users.deleted")}</Notice> : null}
      {query.error ? <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{query.error === "exists" ? t("users.errorExists") : t("users.errorGeneric")}</p> : null}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><UsersRoundIcon className="size-5" />{t("users.allUsers")}</CardTitle><CardDescription>{t("users.count", { count: users.length })}</CardDescription></CardHeader><CardContent className="px-0"><Table><TableHeader><TableRow><TableHead className="pl-6">{t("users.colName")}</TableHead><TableHead>{t("users.colEmail")}</TableHead><TableHead>{t("users.colStatus")}</TableHead><TableHead className="pr-6 text-right"><span className="sr-only">{t("users.colActions")}</span></TableHead></TableRow></TableHeader><TableBody>{users.map((user) => <TableRow key={user.id}><TableCell className="pl-6 font-medium">{user.display_name || "–"}</TableCell><TableCell>{user.email}</TableCell><TableCell><Badge variant={user.is_active ? "default" : "secondary"}>{user.is_active ? t("users.active") : t("users.inactive")}</Badge></TableCell><TableCell className="pr-6 text-right"><div className="flex justify-end gap-1">{user.is_active ? <>{user.id !== actor.id ? <DeactivateUserDialog userId={user.id} userName={user.display_name || user.email} /> : null}</> : <ReactivateUserButton userId={user.id} />}{user.id !== actor.id ? <PermanentlyDeleteUserDialog userId={user.id} userName={user.display_name || user.email} /> : null}</div></TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
        <Card><CardHeader><CardTitle>{t("users.addTitle")}</CardTitle><CardDescription>{t("users.addDescription")}</CardDescription></CardHeader><CardContent><CreateUserForm /></CardContent></Card>
      </div>
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) { return <p className="rounded-lg bg-primary/10 p-3 text-sm text-foreground">{children}</p>; }
