"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { MegaphoneIcon } from "lucide-react";
import { campaignStatusLabels } from "@/lib/campaign-status";
import type { Campaign } from "@/lib/api/types";

export function CampaignsList({ workspaceId, campaigns }: { workspaceId: string; campaigns: Campaign[] }) {
  const [showCompleted, setShowCompleted] = useState(false);
  const completedCount = useMemo(() => campaigns.filter((campaign) => campaign.status === "completed").length, [campaigns]);
  const visible = showCompleted ? campaigns : campaigns.filter((campaign) => campaign.status !== "completed");

  return (
    <div className="flex flex-col gap-4">
      {completedCount > 0 ? (
        <div className="flex items-center justify-end gap-2">
          <Label htmlFor="show-completed" className="text-sm text-muted-foreground">Abgeschlossene anzeigen ({completedCount})</Label>
          <Switch id="show-completed" checked={showCompleted} onCheckedChange={setShowCompleted} />
        </div>
      ) : null}
      {visible.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((campaign) => (
            <Link key={campaign.id} href={`/workspaces/${workspaceId}/campaigns/${campaign.id}`}>
              <Card>
                <CardHeader>
                  <Badge variant={campaign.status === "active" ? "default" : "secondary"}>{campaignStatusLabels[campaign.status]}</Badge>
                  <CardTitle className="mt-4">{campaign.title}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">{campaign.survey_title} · Version {campaign.survey_version_number}</CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Empty className="min-h-72 border bg-card">
          <EmptyHeader>
            <EmptyMedia variant="icon"><MegaphoneIcon /></EmptyMedia>
            <EmptyTitle>Noch keine Kampagnen</EmptyTitle>
            <EmptyDescription>Erstellen Sie eine Kampagne aus einer dieser Klinik zugewiesenen veröffentlichten Umfrage.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </div>
  );
}
