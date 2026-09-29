import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth/config";
import { getAccessToken } from "@/lib/auth/session";

type Params = {
  workspaceId: string;
  campaignId: string;
  format: string;
};

export async function GET(_: Request, { params }: { params: Promise<Params> }) {
  const { workspaceId, campaignId, format } = await params;
  if (format !== "pdf" && format !== "xlsx") {
    return NextResponse.json({ detail: "Export format not found" }, { status: 404 });
  }

  const accessToken = await getAccessToken();
  if (!accessToken) return NextResponse.json({ detail: "Nicht angemeldet" }, { status: 401 });

  const response = await fetch(
    `${authConfig.apiBaseUrl}/api/v1/clinics/${workspaceId}/analytics/campaigns/${campaignId}/export/${format}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    },
  );
  if (!response.ok) {
    return NextResponse.json({ detail: "Export konnte nicht erstellt werden" }, { status: response.status });
  }

  return new NextResponse(response.body, {
    headers: {
      "Content-Type": response.headers.get("Content-Type") ?? "application/octet-stream",
      "Content-Disposition": response.headers.get("Content-Disposition") ?? "attachment",
    },
  });
}
