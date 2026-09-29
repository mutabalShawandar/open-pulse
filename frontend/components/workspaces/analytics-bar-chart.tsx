"use client";

import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

const config = { count: { label: "Antworten", color: "var(--primary)" } } satisfies ChartConfig;

export function AnalyticsBarChart({ data }: { data: Array<{ label: string; count: number }> }) {
  return <ChartContainer config={config} className="mt-4 aspect-[2.4/1]"><BarChart accessibilityLayer data={data}><CartesianGrid vertical={false} /><XAxis dataKey="label" tickLine={false} axisLine={false} /><ChartTooltip content={<ChartTooltipContent />} /><Bar dataKey="count" fill="var(--color-count)" radius={5} /></BarChart></ChartContainer>;
}
