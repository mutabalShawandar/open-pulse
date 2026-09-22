"use client";

import { FileDownIcon, FileSpreadsheetIcon, FileTextIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function AnalyticsExportActions({ clinicId, campaignId }: { clinicId: string; campaignId: string }) {
  const router = useRouter();

  const download = (format: "pdf" | "xlsx") => {
    router.push(`/api/clinics/${clinicId}/analytics/${campaignId}/export/${format}`);
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <FileDownIcon className="size-4" />
        Export
      </span>
      <Button variant="outline" size="sm" onClick={() => download("pdf")}>
        <FileTextIcon data-icon="inline-start" />
        PDF-Bericht
      </Button>
      <Button variant="outline" size="sm" onClick={() => download("xlsx")}>
        <FileSpreadsheetIcon data-icon="inline-start" />
        Excel-Datei
      </Button>
    </div>
  );
}
