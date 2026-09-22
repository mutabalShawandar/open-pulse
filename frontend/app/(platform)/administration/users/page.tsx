import { UsersRoundIcon } from "lucide-react";

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

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-7 sm:px-6 lg:px-10 lg:py-10">
      <section><p className="text-sm font-medium text-muted-foreground">Administration</p><h1 className="mt-2 font-heading text-3xl font-semibold tracking-tight">Benutzer</h1><p className="mt-2 text-muted-foreground">Plattformzugänge erstellen und verwalten.</p></section>
      {query.created ? <Notice>Benutzer angelegt. Keycloak sendet die Konto-Einladung.</Notice> : null}
      {query.deactivated ? <Notice>Benutzer erfolgreich deaktiviert.</Notice> : null}
      {query.reactivated ? <Notice>Benutzer erfolgreich reaktiviert.</Notice> : null}
      {query.deleted ? <Notice>Benutzer dauerhaft gelöscht.</Notice> : null}
      {query.error ? <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{query.error === "exists" ? "Für diese E-Mail-Adresse existiert bereits ein Benutzer." : "Die Aktion konnte nicht durchgeführt werden."}</p> : null}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><UsersRoundIcon className="size-5" />Alle Benutzer</CardTitle><CardDescription>{users.length} Plattformbenutzer</CardDescription></CardHeader><CardContent className="px-0"><Table><TableHeader><TableRow><TableHead className="pl-6">Name</TableHead><TableHead>E-Mail</TableHead><TableHead>Status</TableHead><TableHead className="pr-6 text-right"><span className="sr-only">Aktionen</span></TableHead></TableRow></TableHeader><TableBody>{users.map((user) => <TableRow key={user.id}><TableCell className="pl-6 font-medium">{user.display_name || "–"}</TableCell><TableCell>{user.email}</TableCell><TableCell><Badge variant={user.is_active ? "default" : "secondary"}>{user.is_active ? "Aktiv" : "Deaktiviert"}</Badge></TableCell><TableCell className="pr-6 text-right"><div className="flex justify-end gap-1">{user.is_active ? <>{user.id !== actor.id ? <DeactivateUserDialog userId={user.id} userName={user.display_name || user.email} /> : null}</> : <ReactivateUserButton userId={user.id} />}{user.id !== actor.id ? <PermanentlyDeleteUserDialog userId={user.id} userName={user.display_name || user.email} /> : null}</div></TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
        <Card><CardHeader><CardTitle>Benutzer hinzufügen</CardTitle><CardDescription>Keycloak erstellt den Zugang und sendet eine Einladungs-E-Mail.</CardDescription></CardHeader><CardContent><CreateUserForm /></CardContent></Card>
      </div>
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) { return <p className="rounded-lg bg-primary/10 p-3 text-sm text-foreground">{children}</p>; }
