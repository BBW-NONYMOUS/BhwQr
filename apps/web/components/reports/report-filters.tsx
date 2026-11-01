"use client";

import { statusColors } from "@bhw/design-tokens";
import { ATTENDANCE_STATUSES } from "@bhw/types";
import { Loader2Icon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { mondayOf } from "@/lib/format";

import { MONTH_NAMES } from "./period";
import { REPORT_TABS, type ReportParams, type ReportTab, reportQuery } from "./report-utils";

const ALL = "__all__";
const TAB_LABELS: Record<ReportTab, string> = { daily: "Daily", weekly: "Weekly", monthly: "Monthly" };

/** Period tabs and filters. Every change is written to the URL; the server renders the report. */
export function ReportFilters({
  params,
  areas,
  years,
  today,
}: {
  params: ReportParams;
  areas: string[];
  years: number[];
  today: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  function navigate(next: Partial<ReportParams>) {
    const p = { ...params, ...next };
    const query = reportQuery({
      tab: p.tab,
      area: p.area,
      ...(p.tab === "daily" ? { date: p.date, status: p.status } : {}),
      ...(p.tab === "weekly" ? { weekStart: p.weekStart } : {}),
      ...(p.tab === "monthly" ? { year: p.year, month: p.month } : {}),
    });
    startTransition(() => router.push(`${pathname}?${query}`));
  }

  return (
    <div className="space-y-4 print:hidden" aria-busy={pending}>
      <Tabs value={params.tab} onValueChange={(v) => navigate({ tab: v as ReportTab })}>
        <TabsList aria-label="Report period">
          {REPORT_TABS.map((t) => (
            <TabsTrigger key={t} value={t} className="px-4">
              {TAB_LABELS[t]}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <div className="flex flex-wrap items-end gap-3">
        {params.tab === "daily" ? (
          <div className="grid gap-1.5">
            <Label htmlFor="report-date">Date</Label>
            <Input
              id="report-date"
              type="date"
              className="w-44"
              value={params.date}
              max={today}
              onChange={(e) => e.target.value && navigate({ date: e.target.value })}
            />
          </div>
        ) : null}

        {params.tab === "weekly" ? (
          <div className="grid gap-1.5">
            <Label htmlFor="report-week">Week starting (Monday)</Label>
            <Input
              id="report-week"
              type="date"
              className="w-44"
              value={params.weekStart}
              aria-describedby="report-week-hint"
              onChange={(e) => e.target.value && navigate({ weekStart: mondayOf(e.target.value) })}
            />
            <span id="report-week-hint" className="sr-only">
              Any date picks the Monday of its week.
            </span>
          </div>
        ) : null}

        {params.tab === "monthly" ? (
          <>
            <div className="grid gap-1.5">
              <Label htmlFor="report-month">Month</Label>
              <Select value={String(params.month)} onValueChange={(v) => navigate({ month: Number(v) })}>
                <SelectTrigger id="report-month" className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTH_NAMES.map((name, i) => (
                    <SelectItem key={name} value={String(i + 1)}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="report-year">Year</Label>
              <Select value={String(params.year)} onValueChange={(v) => navigate({ year: Number(v) })}>
                <SelectTrigger id="report-year" className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {years.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        ) : null}

        <div className="grid gap-1.5">
          <Label htmlFor="report-area">Area</Label>
          <Select value={params.area ?? ALL} onValueChange={(v) => navigate({ area: v === ALL ? null : v })}>
            <SelectTrigger id="report-area" className="w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All areas</SelectItem>
              {areas.length ? <SelectSeparator /> : null}
              {areas.map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {params.tab === "daily" ? (
          <div className="grid gap-1.5">
            <Label htmlFor="report-status">Status</Label>
            <Select
              value={params.status ?? ALL}
              onValueChange={(v) => navigate({ status: v === ALL ? null : (v as ReportParams["status"]) })}
            >
              <SelectTrigger id="report-status" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All statuses</SelectItem>
                <SelectSeparator />
                {ATTENDANCE_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {statusColors[s].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {pending ? (
          <span className="flex h-9 items-center gap-1.5 text-sm text-muted-foreground" role="status">
            <Loader2Icon className="size-4 animate-spin" aria-hidden />
            Loading…
          </span>
        ) : null}
      </div>
    </div>
  );
}
