"use client";

import { Bar, BarChart, CartesianGrid, Cell, Label, Pie, PieChart, XAxis, YAxis } from "recharts";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

import type { DailyTotals, MonthlyReportRow, WeekdayCounts } from "./report-utils";

// Status colors come from the chart tokens (packages/design-tokens): teal on time, amber late,
// red absent, zinc no time-out, orange undertime. "No record yet" uses the muted foreground.
const STATUS_CHART_CONFIG = {
  on_time: { label: "On time", color: "var(--chart-1)" },
  late: { label: "Late", color: "var(--chart-2)" },
  undertime: { label: "Undertime", color: "var(--chart-5)" },
  incomplete: { label: "No time-out", color: "var(--chart-4)" },
  absent: { label: "Absent", color: "var(--chart-3)" },
  no_record: { label: "No record yet", color: "color-mix(in oklch, var(--muted-foreground) 40%, transparent)" },
} satisfies ChartConfig;

type StatusKey = keyof typeof STATUS_CHART_CONFIG;
const STATUS_KEYS = Object.keys(STATUS_CHART_CONFIG) as StatusKey[];

function ChartCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <Card className="print:hidden">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/** Daily: donut of the displayed rows by status. */
export function DailyStatusChart({ totals }: { totals: DailyTotals }) {
  const data = STATUS_KEYS.map((key) => ({ status: key, count: totals[key], fill: `var(--color-${key})` })).filter(
    (d) => d.count > 0,
  );
  const summary = data.map((d) => `${STATUS_CHART_CONFIG[d.status].label} ${d.count}`).join(", ");
  return (
    <ChartCard title="Status breakdown" description={`${totals.employees} employees in this report`}>
      <ChartContainer
        config={STATUS_CHART_CONFIG}
        className="mx-auto aspect-square max-h-72"
        role="img"
        aria-label={`Status breakdown: ${summary || "no rows"}`}
      >
        <PieChart>
          <ChartTooltip cursor={false} content={<ChartTooltipContent nameKey="status" hideLabel />} />
          <Pie data={data} dataKey="count" nameKey="status" innerRadius={60} strokeWidth={4}>
            {data.map((d) => (
              <Cell key={d.status} fill={d.fill} />
            ))}
            <Label
              content={({ viewBox }) =>
                viewBox && "cx" in viewBox && "cy" in viewBox ? (
                  <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                    <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-2xl font-semibold">
                      {totals.present}
                    </tspan>
                    <tspan x={viewBox.cx} y={(viewBox.cy ?? 0) + 20} className="fill-muted-foreground text-xs">
                      present
                    </tspan>
                  </text>
                ) : null
              }
            />
          </Pie>
          <ChartLegend content={<ChartLegendContent nameKey="status" />} className="flex-wrap" />
        </PieChart>
      </ChartContainer>
    </ChartCard>
  );
}

/** Weekly: stacked bars per day, counted from each position of daily_status (FR-96). */
export function WeeklyStackedChart({ days }: { days: WeekdayCounts[] }) {
  const summary = days
    .map((d) => `${d.label}: ${d.on_time} on time, ${d.late} late, ${d.absent} absent`)
    .join("; ");
  return (
    <ChartCard title="Attendance per day" description="Monday to Sunday, counted from each employee's daily status">
      <ChartContainer
        config={STATUS_CHART_CONFIG}
        className="aspect-auto h-72 w-full"
        role="img"
        aria-label={`Attendance per day. ${summary}`}
      >
        <BarChart data={days} accessibilityLayer>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={28} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <ChartLegend content={<ChartLegendContent />} className="flex-wrap" />
          {STATUS_KEYS.map((key, i) => (
            <Bar
              key={key}
              dataKey={key}
              stackId="day"
              fill={`var(--color-${key})`}
              radius={i === STATUS_KEYS.length - 1 ? [4, 4, 0, 0] : 0}
            />
          ))}
        </BarChart>
      </ChartContainer>
    </ChartCard>
  );
}

const MONTHLY_CONFIG = {
  late_days: { label: "Late days", color: "var(--chart-2)" },
  absent_days: { label: "Absent days", color: "var(--chart-3)" },
} satisfies ChartConfig;

/** Monthly: late and absent days per employee (horizontal bars, one row per employee). */
export function MonthlyLateAbsentChart({ rows }: { rows: MonthlyReportRow[] }) {
  const data = rows.map((r) => ({ name: r.full_name, late_days: r.late_days, absent_days: r.absent_days }));
  const height = Math.max(240, data.length * 34 + 60);
  return (
    <ChartCard title="Late and absent days" description="Per employee for the month">
      <ChartContainer
        config={MONTHLY_CONFIG}
        className="aspect-auto w-full"
        style={{ height }}
        role="img"
        aria-label={`Late and absent days per employee: ${data
          .map((d) => `${d.name} ${d.late_days} late, ${d.absent_days} absent`)
          .join("; ")}`}
      >
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }} accessibilityLayer>
          <CartesianGrid horizontal={false} />
          <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
          <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} width={160} interval={0} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar dataKey="late_days" fill="var(--color-late_days)" radius={3} />
          <Bar dataKey="absent_days" fill="var(--color-absent_days)" radius={3} />
        </BarChart>
      </ChartContainer>
    </ChartCard>
  );
}
