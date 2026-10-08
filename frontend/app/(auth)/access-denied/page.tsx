import { getTranslations } from "next-intl/server";
import { ShieldAlertIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export default async function AccessDeniedPage() {
  const t = await getTranslations("auth.accessDenied");
  return <main className="grid min-h-screen place-items-center bg-muted/30 p-6"><section className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-sm"><ShieldAlertIcon className="size-8 text-destructive" /><h1 className="mt-6 text-2xl font-semibold tracking-tight">{t("title")}</h1><p className="mt-2 text-muted-foreground">{t("body")}</p><Button nativeButton={false} render={<a href="/login" />} variant="outline" className="mt-8">{t("toLogin")}</Button></section></main>;
}
