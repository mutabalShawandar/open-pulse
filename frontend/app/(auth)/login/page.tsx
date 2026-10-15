import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LogInIcon } from "lucide-react";
import { organizationRegistrationEnabled } from "@/lib/features";
import { Button } from "@/components/ui/button";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;
  const t = await getTranslations("auth.login");
  return <main className="grid min-h-screen place-items-center bg-muted/30 p-6"><section className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-sm"><p className="font-heading text-2xl font-semibold">OpenPulse</p><h1 className="mt-10 text-2xl font-semibold tracking-tight">{t("title")}</h1><p className="mt-2 text-muted-foreground">{t("description")}</p>{error ? <p className="mt-6 rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{t("error")}</p> : null}<Button nativeButton={false} render={<a href="/auth/login" />} size="lg" className="mt-8 w-full"><LogInIcon data-icon="inline-start" />{t("submit")}</Button>{organizationRegistrationEnabled() ? <Link href="/register" className="mt-6 block text-center text-sm text-muted-foreground underline-offset-4 hover:underline">{t("register")}</Link> : null}</section></main>;
}
