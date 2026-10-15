import { MailCheckIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { SmtpConfigurationForm } from "@/components/administration/smtp-configuration-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ApiError, getSmtpConfiguration } from "@/lib/api/client";
import { requireUser } from "@/lib/auth/require-user";
import { getAccessToken } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import type { SmtpConfiguration } from "@/lib/api/types";

export default async function EmailAdministrationPage({ searchParams }: PageProps<"/administration/email">) {
  await requireUser();
  const accessToken = await getAccessToken();
  if (!accessToken) return null;
  const t = await getTranslations("admin.email");
  let configuration: SmtpConfiguration | null = null;
  let availabilityMessage: string | null = null;
  try {
    configuration = await getSmtpConfiguration(accessToken);
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) redirect("/access-denied");
    if (error instanceof ApiError && error.status === 404) {
      availabilityMessage = t("unavailable404");
    } else {
      availabilityMessage = t("unavailableGeneric");
    }
  }
  const query = await searchParams;
  const errorMessage = query.error ? t("actionError") : null;

  return <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-4 py-7 sm:px-6 lg:px-10 lg:py-10">
    <section><p className="text-sm font-medium text-muted-foreground">{(await getTranslations("admin"))("eyebrow")}</p><h1 className="mt-2 font-heading text-3xl font-semibold tracking-tight">{t("title")}</h1><p className="mt-2 text-muted-foreground">{t("intro")}</p></section>
    {query.saved ? <Alert><MailCheckIcon /><AlertTitle>{t("saved")}</AlertTitle><AlertDescription>{t("savedBody")}</AlertDescription></Alert> : null}
    {query.tested ? <Alert><MailCheckIcon /><AlertTitle>{t("tested")}</AlertTitle><AlertDescription>{t("testedBody")}</AlertDescription></Alert> : null}
    {errorMessage ? <Alert variant="destructive"><AlertTitle>{t("failedTitle")}</AlertTitle><AlertDescription>{errorMessage}</AlertDescription></Alert> : null}
    {availabilityMessage ? <Alert variant="destructive"><AlertTitle>{t("unavailableTitle")}</AlertTitle><AlertDescription>{availabilityMessage}</AlertDescription></Alert> : <Card><CardHeader><CardTitle>{t("cardTitle")}</CardTitle><CardDescription>{t("cardDescription")}</CardDescription></CardHeader><CardContent><SmtpConfigurationForm configuration={configuration} /></CardContent></Card>}
  </div>;
}
