"use client";

import { Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts";

import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

import type { HeartbeatPoint } from "./health";

const config = {
  count: { label: "Heartbeats", color: "var(--chart-1)" },
} satisfies ChartConfig;

/**
 * Heartbeats per 5-minute bucket over the last hour. The dashed line is the expected count
 * (300 s / heartbeat interval); gaps below it mean missed heartbeats.
 */
export function HeartbeatSparkline({ points, expectedPerBucket }: { points: HeartbeatPoint[]; expectedPerBucket: number }) {
  const total = points.reduce((s, p) => s + p.count, 0);
  const expected = Math.round(expectedPerBucket * points.length);
  return (
    <figure className="space-y-1">
      <ChartContainer
        config={config}
        className="aspect-auto h-14 w-full"
        role="img"
        aria-label={`${total} heartbeats in the last hour; about ${expected} expected.`}
      >
        <LineChart data={points} margin={{ top: 4, right: 4, bottom: 4, left: 4 }} accessibilityLayer>
          <XAxis dataKey="label" hide />
          <YAxis hide domain={[0, Math.max(expectedPerBucket, ...points.map((p) => p.count)) + 1]} />
          <ReferenceLine y={expectedPerBucket} stroke="var(--border)" strokeDasharray="3 3" />
          <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
          <Line
            dataKey="count"
            type="monotone"
            stroke="var(--color-count)"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ChartContainer>
      <figcaption className="text-xs text-muted-foreground tabular-nums">
        {total} / ~{expected} heartbeats in the last hour
      </figcaption>
    </figure>
  );
}
