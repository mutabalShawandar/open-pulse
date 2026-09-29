import { notFound } from "next/navigation";
import { ClipboardCheck } from "lucide-react";

import { PublicSurveyForm } from "@/components/public/public-survey-form";
import { getPublicCampaign } from "@/lib/api/public";
import { campaignSlugFromPath } from "@/lib/public-link";

export default async function PublicSurveyPage(props: PageProps<"/respond/[slug]">) {
  const { slug } = await props.params;
  const campaignSlug = campaignSlugFromPath(slug);
  const campaign = await getPublicCampaign(campaignSlug);
  if (!campaign) notFound();

  const accent = campaign.branding?.accent_color;

  return (
    <main
      className="min-h-screen bg-[radial-gradient(circle_at_top_left,var(--accent),transparent_34rem)] px-4 py-8 sm:py-14"
      style={{ "--accent": accent ? `${accent}20` : "var(--secondary)" } as React.CSSProperties}
    >
      <div className="mx-auto max-w-3xl">
        <header className="mb-8 text-center">
          {campaign.logo_url ? (
            <img src={campaign.logo_url} alt={`${campaign.clinic_name} Logo`} className="mx-auto mb-5 size-16 rounded-2xl bg-white object-contain p-1 shadow-lg" />
          ) : (
            <div className="mx-auto mb-5 flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
              <ClipboardCheck className="size-6" />
            </div>
          )}
          <p className="text-xs font-semibold tracking-[0.2em] text-primary uppercase">
            {campaign.clinic_name || "Ihre Meinung zählt"}
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">{campaign.title}</h1>
          {campaign.description ? <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">{campaign.description}</p> : null}
        </header>
        <PublicSurveyForm campaign={campaign} slug={campaignSlug} />
        <footer className="flex flex-col items-center gap-3 py-8 text-center text-xs text-muted-foreground">
          <p>Diese Umfrage wird anonym verarbeitet.</p>
          <nav aria-label="Rechtliche Informationen" className="flex flex-wrap justify-center gap-x-4 gap-y-2">
            <a className="underline underline-offset-4 hover:text-foreground" href="https://example.com/impressum/" target="_blank" rel="noreferrer">Impressum</a>
            <a className="underline underline-offset-4 hover:text-foreground" href="https://example.com/datenschutz/" target="_blank" rel="noreferrer">Datenschutz</a>
            <a className="underline underline-offset-4 hover:text-foreground" href="https://example.com/agb/" target="_blank" rel="noreferrer">AGB</a>
          </nav>
        </footer>
      </div>
    </main>
  );
}
