"use client";

import { statusColors } from "@bhw/design-tokens";
import { BarChart3Icon } from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";

import { EmptyState } from "@/components/states";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

import { TREND_SERIES, isTrendEmpty, type TrendPoint, type TrendSeries } from "./dashboard-data";

/** Status → --chart-* token (packages/design-tokens): teal, amber, orange, zinc, red. */
const SERIES_COLOR: Record<TrendSeries, string> = {
  on_time: "var(--chart-1)",
  late: "var(--chart-2)",
  undertime: "var(--chart-5)",
  incomplete: "var(--chart-4)",
  absent: "var(--chart-3)",
};

const chartConfig = Object.fromEntries(
  TREND_SERIES.map((key) => [key, { label: statusColors[key].label, color: SERIES_COLOR[key] }]),
) satisfies ChartConfig;

/**
 * Stacked bar chart of the last 7 Manila days (get_attendance_trend). A visually hidden table
 * carries the same numbers for screen readers.
 */
export function TrendChart({ data }: { data: TrendPoint[] }) {
  if (isTrendEmpty(data)) {
    return (
      <EmptyState
        icon={BarChart3Icon}
        title="No attendance in the last 7 days"
        description="Bars appear here once employees start scanning at the kiosk."
      />
    );
  }

  return (
    <figure className="space-y-2">
      <ChartContainer
        config={chartConfig}
        className="aspect-auto h-72 w-full"
        aria-hidden="true"
      >
        <BarChart data={data} margin={{ left: -16, right: 4, top: 8 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={40} />
          <ChartTooltip
            cursor={false}
            content={
              <ChartTooltipContent
                indicator="dot"
                labelFormatter={(_, payload) => (payload?.[0]?.payload as TrendPoint | undefined)?.fullLabel ?? ""}
              />
            }
          />
          <ChartLegend content={<ChartLegendContent />} />
          {TREND_SERIES.map((key, i) => (
            <Bar
              key={key}
              dataKey={key}
              stackId="status"
              fill={`var(--color-${key})`}
              radius={i === TREND_SERIES.length - 1 ? [4, 4, 0, 0] : 0}
              maxBarSize={48}
            />
          ))}
        </BarChart>
      </ChartContainer>
      <figcaption className="sr-only">
        <table>
          <caption>Attendance by status for the last 7 days</caption>
          <thead>
            <tr>
              <th scope="col">Day</th>
              {TREND_SERIES.map((key) => (
                <th key={key} scope="col">
                  {statusColors[key].label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((p) => (
              <tr key={p.date}>
                <th scope="row">{p.fullLabel}</th>
                {TREND_SERIES.map((key) => (
                  <td key={key}>{p[key]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </figcaption>
    </figure>
  );
}
