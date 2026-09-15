import { ShieldAlertIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AccessDeniedPage() {
  return <main className="grid min-h-screen place-items-center bg-muted/30 p-6"><section className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-sm"><ShieldAlertIcon className="size-8 text-destructive" /><h1 className="mt-6 text-2xl font-semibold tracking-tight">Zugriff nicht eingerichtet</h1><p className="mt-2 text-muted-foreground">Ihr Keycloak-Konto hat noch keinen aktiven Zugriff auf die Plattform. Wenden Sie sich an Ihre Administration.</p><Button nativeButton={false} render={<a href="/login" />} variant="outline" className="mt-8">Zur Anmeldung</Button></section></main>;
}
