import type { Campaign } from "@/lib/api/types";

// Display labels live in messages/*.json under "campaigns.status.{status}".
export const campaignStatuses: Campaign["status"][] = ["draft", "scheduled", "active", "paused", "completed", "cancelled"];
