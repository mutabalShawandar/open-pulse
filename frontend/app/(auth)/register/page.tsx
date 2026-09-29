import Link from "next/link";
import { MailCheckIcon } from "lucide-react";

import { RegisterOrganizationForm } from "@/components/auth/register-organization-form";

const ERROR_MESSAGES: Record<string, string> = {
  "slug-taken": "Diese Adresse ist bereits vergeben. Bitte wählen Sie eine andere.",
  validation: "Bitte füllen Sie alle Felder korrekt aus.",
  "rate-limited": "Zu viele Versuche. Bitte versuchen Sie es in einer Minute erneut.",
  unknown: "Die Organisation konnte nicht angelegt werden. Bitte versuchen Sie es erneut.",
};

export default async function RegisterPage({ searchParams }: PageProps<"/register">) {
  const { error, registered } = await searchParams;

  return (
    <main className="grid min-h-screen place-items-center bg-muted/30 p-6">
      <section className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-sm">
        <p className="font-heading text-2xl font-semibold">OpenPulse</p>
        {registered ? (
          <>
            <h1 className="mt-10 flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <MailCheckIcon className="size-6" />
              Fast geschafft
            </h1>
            <p className="mt-2 text-muted-foreground">
              Wir haben Ihnen eine E-Mail geschickt. Bestätigen Sie Ihre Adresse und legen Sie ein
              Passwort fest, um sich anzumelden.
            </p>
            <Link href="/login" className="mt-8 block text-center text-sm font-medium text-primary underline-offset-4 hover:underline">
              Zur Anmeldung
            </Link>
          </>
        ) : (
          <>
            <h1 className="mt-10 text-2xl font-semibold tracking-tight">Organisation registrieren</h1>
            <p className="mt-2 text-muted-foreground">
              Legen Sie Ihre Organisation an und werden Sie deren erste:r Administrator:in.
            </p>
            {typeof error === "string" && ERROR_MESSAGES[error] ? (
              <p className="mt-6 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                {ERROR_MESSAGES[error]}
              </p>
            ) : null}
            <div className="mt-8">
              <RegisterOrganizationForm />
            </div>
            <Link href="/login" className="mt-6 block text-center text-sm text-muted-foreground underline-offset-4 hover:underline">
              Bereits registriert? Anmelden
            </Link>
          </>
        )}
      </section>
    </main>
  );
}
