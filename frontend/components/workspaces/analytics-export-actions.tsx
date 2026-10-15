"use client";

import { FileDownIcon, FileSpreadsheetIcon, FileTextIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export function AnalyticsExportActions({ workspaceId, campaignId }: { workspaceId: string; campaignId: string }) {
  const router = useRouter();
  const t = useTranslations("analytics");

  const download = (format: "pdf" | "xlsx") => {
    router.push(`/api/workspaces/${workspaceId}/analytics/${campaignId}/export/${format}`);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <FileDownIcon className="size-4" />
        {t("export")}
      </span>
      <Button variant="outline" size="sm" onClick={() => download("pdf")}>
        <FileTextIcon data-icon="inline-start" />
        {t("pdf")}
      </Button>
      <Button variant="outline" size="sm" onClick={() => download("xlsx")}>
        <FileSpreadsheetIcon data-icon="inline-start" />
        {t("xlsx")}
      </Button>
    </div>
  );
}
