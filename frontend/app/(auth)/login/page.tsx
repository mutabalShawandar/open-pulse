import { LogInIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;
  return <main className="grid min-h-screen place-items-center bg-muted/30 p-6"><section className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-sm"><p className="font-heading text-2xl font-semibold">Praxisumfragen</p><h1 className="mt-10 text-2xl font-semibold tracking-tight">Anmelden</h1><p className="mt-2 text-muted-foreground">Melden Sie sich mit Ihrem Plattformkonto an.</p>{error ? <p className="mt-6 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">Die Anmeldung konnte nicht abgeschlossen werden. Bitte versuchen Sie es erneut.</p> : null}<Button nativeButton={false} render={<a href="/auth/login" />} size="lg" className="mt-8 w-full"><LogInIcon data-icon="inline-start" />Mit Keycloak anmelden</Button></section></main>;
}
