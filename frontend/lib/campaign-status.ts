import type { Campaign } from "@/lib/api/types";

export const campaignStatusLabels: Record<Campaign["status"], string> = {
  draft: "Entwurf",
  scheduled: "Geplant",
  active: "Versendet",
  paused: "Pausiert",
  completed: "Abgeschlossen",
  cancelled: "Abgebrochen",
};
