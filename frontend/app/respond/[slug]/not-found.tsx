import { getTranslations } from "next-intl/server";
import { CalendarX2, ClipboardCheck, ShieldCheck } from "lucide-react";

export default async function PublicSurveyUnavailablePage() {
  const t = await getTranslations("publicSurvey");
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-5 py-10 text-foreground">
      <div aria-hidden="true" className="absolute -left-24 top-0 size-72 rounded-full bg-chart-2/20 blur-3xl" />
      <div aria-hidden="true" className="absolute -bottom-28 -right-24 size-96 rounded-full bg-primary/15 blur-3xl" />

      <section className="relative w-full max-w-xl rounded-[2rem] border border-border bg-card/90 p-8 shadow-2xl backdrop-blur sm:p-12">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
            <ClipboardCheck className="size-6" aria-hidden="true" />
          </div>
          <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold tracking-[0.12em] text-muted-foreground uppercase">{t("badge")}</span>
        </div>

        <div className="flex gap-5">
          <div className="mt-1 flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <CalendarX2 className="size-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-sm font-semibold tracking-wide text-primary uppercase">{t("unavailable")}</p>
            <h1 className="mt-2 font-serif text-4xl leading-tight tracking-tight text-foreground sm:text-5xl">{t("closedTitle")}</h1>
            <p className="mt-5 max-w-md text-base leading-7 text-muted-foreground">{t("closedBody")}</p>
          </div>
        </div>

        <div className="mt-10 flex items-start gap-3 border-t border-border pt-6 text-sm leading-6 text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
          <p>{t("closedNote")}</p>
        </div>
      </section>
    </main>
  );
}
