import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { MailCheckIcon } from "lucide-react";

import { organizationRegistrationEnabled } from "@/lib/features";
import { RegisterOrganizationForm } from "@/components/auth/register-organization-form";

export default async function RegisterPage({ searchParams }: PageProps<"/register">) {
  if (!organizationRegistrationEnabled()) notFound();
  const { error, registered } = await searchParams;
  const t = await getTranslations("auth.register");
  const errorKeys = ["slug-taken", "validation", "rate-limited", "unknown"];

  return (
    <main className="grid min-h-screen place-items-center bg-muted/30 p-6">
      <section className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-sm">
        <p className="font-heading text-2xl font-semibold">OpenPulse</p>
        {registered ? (
          <>
            <h1 className="mt-10 flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <MailCheckIcon className="size-6" />
              {t("doneTitle")}
            </h1>
            <p className="mt-2 text-muted-foreground">
              {t("doneBody")}
            </p>
            <Link href="/login" className="mt-8 block text-center text-sm font-medium text-primary underline-offset-4 hover:underline">
              {t("toLogin")}
            </Link>
          </>
        ) : (
          <>
            <h1 className="mt-10 text-2xl font-semibold tracking-tight">{t("heading")}</h1>
            <p className="mt-2 text-muted-foreground">
              {t("description")}
            </p>
            {typeof error === "string" && errorKeys.includes(error) ? (
              <p className="mt-6 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
                {t(`errors.${error}`)}
              </p>
            ) : null}
            <div className="mt-8">
              <RegisterOrganizationForm />
            </div>
            <Link href="/login" className="mt-6 block text-center text-sm text-muted-foreground underline-offset-4 hover:underline">
              {t("haveAccount")}
            </Link>
          </>
        )}
      </section>
    </main>
  );
}
