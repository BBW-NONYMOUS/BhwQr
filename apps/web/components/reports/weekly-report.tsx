"use client";

import { statusColors } from "@bhw/design-tokens";
import type { AttendanceStatus } from "@bhw/types";
import type { ColumnDef } from "@tanstack/react-table";

import { DataTable } from "@/components/data-table";
import { formatMinutes } from "@/lib/format";
import { cn } from "@/lib/utils";

import { WeeklyStackedChart } from "./report-charts";
import { type PrintColumn, ReportPrintTable, TotalsStrip } from "./report-print";
import { type WeekdayCounts, type WeeklyReportRow, weeklyPerDay, weeklyTotals } from "./report-utils";

export const STATUS_ABBR: Record<AttendanceStatus, string> = {
  on_time: "OT",
  late: "L",
  undertime: "U",
  incomplete: "NT",
  absent: "A",
};

const DOT_CLASSES: Record<AttendanceStatus, string> = {
  on_time: "bg-status-on-time text-status-on-time-foreground",
  late: "bg-status-late text-status-late-foreground",
  undertime: "bg-status-undertime text-status-undertime-foreground",
  incomplete: "bg-status-incomplete text-status-incomplete-foreground",
  absent: "bg-status-absent text-status-absent-foreground",
};

function DayCell({ status, day }: { status: AttendanceStatus | null; day: string }) {
  if (!status) {
    return (
      <span className="text-muted-foreground" title={`${day}: no record`}>
        <span aria-hidden>—</span>
        <span className="sr-only">No record</span>
      </span>
    );
  }
  const label = statusColors[status].label;
  return (
    <span
      className={cn("inline-flex h-6 min-w-7 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold", DOT_CLASSES[status])}
      title={`${day}: ${label}`}
    >
      <span aria-hidden>{STATUS_ABBR[status]}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}

const dayStatus = (r: WeeklyReportRow, i: number) => r.daily_status[i] ?? null;

function buildColumns(days: WeekdayCounts[]): ColumnDef<WeeklyReportRow, unknown>[] {
  return [
    { accessorKey: "full_name", header: "Name", cell: ({ row }) => <span className="font-medium">{row.original.full_name}</span> },
    { accessorKey: "area", header: "Area", cell: ({ row }) => row.original.area ?? "—" },
    ...days.map<ColumnDef<WeeklyReportRow, unknown>>((d, i) => ({
      id: `day-${i}`,
      header: d.label,
      enableSorting: false,
      enableGlobalFilter: false,
      cell: ({ row }) => <DayCell status={dayStatus(row.original, i)} day={d.label} />,
    })),
    { accessorKey: "on_time_days", header: "On time" },
    { accessorKey: "late_days", header: "Late" },
    { accessorKey: "undertime_days", header: "Undertime" },
    { accessorKey: "absent_days", header: "Absent" },
    { accessorKey: "incomplete_days", header: "No time-out" },
    { accessorKey: "total_minutes_late", header: "Late (min)" },
    { accessorKey: "total_undertime_minutes", header: "Undertime (min)" },
  ];
}

function buildCsv(days: WeekdayCounts[]): { header: string; value: (r: WeeklyReportRow) => string | number | null }[] {
  return [
    { header: "Name", value: (r) => r.full_name },
    { header: "Area", value: (r) => r.area },
    { header: "Week start", value: (r) => r.week_start },
    { header: "Week end", value: (r) => r.week_end },
    ...days.map((d, i) => ({
      header: `${d.label} (${d.date})`,
      value: (r: WeeklyReportRow) => {
        const s = dayStatus(r, i);
        return s ? statusColors[s].label : "";
      },
    })),
    { header: "On time days", value: (r) => r.on_time_days },
    { header: "Late days", value: (r) => r.late_days },
    { header: "Undertime days", value: (r) => r.undertime_days },
    { header: "Absent days", value: (r) => r.absent_days },
    { header: "No time-out days", value: (r) => r.incomplete_days },
    { header: "Total minutes late", value: (r) => r.total_minutes_late },
    { header: "Total undertime minutes", value: (r) => r.total_undertime_minutes },
  ];
}

function buildPrintColumns(days: WeekdayCounts[]): PrintColumn<WeeklyReportRow>[] {
  return [
    { header: "Name", value: (r) => r.full_name },
    { header: "Area", value: (r) => r.area },
    ...days.map<PrintColumn<WeeklyReportRow>>((d, i) => ({
      header: d.label,
      align: "center",
      value: (r) => {
        const s = dayStatus(r, i);
        return s ? STATUS_ABBR[s] : "—";
      },
    })),
    { header: "On time", value: (r) => r.on_time_days, align: "right" },
    { header: "Late", value: (r) => r.late_days, align: "right" },
    { header: "Undertime", value: (r) => r.undertime_days, align: "right" },
    { header: "Absent", value: (r) => r.absent_days, align: "right" },
    { header: "No time-out", value: (r) => r.incomplete_days, align: "right" },
    { header: "Late (min)", value: (r) => r.total_minutes_late, align: "right" },
    { header: "Undertime (min)", value: (r) => r.total_undertime_minutes, align: "right" },
  ];
}

export function WeeklyReport({
  rows,
  weekStart,
  fileStem,
  caption,
}: {
  rows: WeeklyReportRow[];
  weekStart: string;
  fileStem: string;
  caption: string;
}) {
  const days = weeklyPerDay(rows, weekStart);
  const totals = weeklyTotals(rows);
  const presentPerDay = days.map((d) => d.on_time + d.late + d.undertime + d.incomplete);

  return (
    <div className="space-y-4">
      {rows.length > 0 ? (
        <>
          <WeeklyStackedChart days={days} />
          <TotalsStrip
            label={`Totals for ${totals.employees} employees (counted from the rows below)`}
            items={[
              { label: "On-time days", value: totals.on_time_days },
              { label: "Late days", value: totals.late_days },
              { label: "Undertime days", value: totals.undertime_days },
              { label: "Absent days", value: totals.absent_days },
              { label: "No time-out days", value: totals.incomplete_days },
              { label: "Total lateness", value: formatMinutes(totals.total_minutes_late) },
              { label: "Total undertime", value: formatMinutes(totals.total_undertime_minutes) },
            ]}
          />
        </>
      ) : null}

      <div className="print:hidden">
        <DataTable
          columns={buildColumns(days)}
          data={rows}
          searchPlaceholder="Search name or area"
          csvFileName={fileStem}
          csv={buildCsv(days)}
          emptyTitle="No employees match these filters"
          emptyDescription="Try another week or area."
        />
      </div>

      <ReportPrintTable
        caption={caption}
        columns={buildPrintColumns(days)}
        rows={rows}
        totals={[
          "TOTAL",
          `${totals.employees} employees`,
          ...presentPerDay.map((n) => `${n} in`),
          totals.on_time_days,
          totals.late_days,
          totals.undertime_days,
          totals.absent_days,
          totals.incomplete_days,
          totals.total_minutes_late,
          totals.total_undertime_minutes,
        ]}
      />
      <p className="report-print hidden pt-1 text-[8pt] print:block">
        Legend: OT on time · L late · U undertime · NT no time-out · A absent · — no record. Day totals count
        employees with a time-in that day.
      </p>
    </div>
  );
}
