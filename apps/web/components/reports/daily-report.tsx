"use client";

import { statusColors } from "@bhw/design-tokens";
import { METHOD_LABELS } from "@bhw/types";
import type { ColumnDef } from "@tanstack/react-table";

import { DataTable } from "@/components/data-table";
import { MethodBadge } from "@/components/method-badge";
import { StatusBadge } from "@/components/status-badge";
import { formatMinutes, formatTime } from "@/lib/format";

import { DailyStatusChart } from "./report-charts";
import { type PrintColumn, ReportPrintTable, TotalsStrip } from "./report-print";
import { type DailyReportRow, dailyTotals } from "./report-utils";

const statusLabel = (r: DailyReportRow) => (r.status ? statusColors[r.status].label : "No record yet");

const columns: ColumnDef<DailyReportRow, unknown>[] = [
  { accessorKey: "full_name", header: "Name", cell: ({ row }) => <span className="font-medium">{row.original.full_name}</span> },
  { accessorKey: "bhw_id_number", header: "BHW ID", cell: ({ row }) => row.original.bhw_id_number ?? "—" },
  { accessorKey: "area", header: "Area", cell: ({ row }) => row.original.area ?? "—" },
  { accessorKey: "time_in", header: "Time in", cell: ({ row }) => formatTime(row.original.time_in) },
  { accessorKey: "time_out", header: "Time out", cell: ({ row }) => formatTime(row.original.time_out) },
  {
    id: "status",
    accessorFn: statusLabel,
    header: "Status",
    cell: ({ row }) =>
      row.original.status ? (
        <StatusBadge status={row.original.status} />
      ) : (
        <span className="text-muted-foreground">No record yet</span>
      ),
  },
  { accessorKey: "minutes_late", header: "Late (min)" },
  { accessorKey: "undertime_minutes", header: "Undertime (min)" },
  {
    id: "method",
    accessorFn: (r) => (r.method ? METHOD_LABELS[r.method] : ""),
    header: "Method",
    cell: ({ row }) => (row.original.method ? <MethodBadge method={row.original.method} /> : "—"),
  },
  { accessorKey: "station_name", header: "Station", cell: ({ row }) => row.original.station_name ?? "—" },
];

const csv: { header: string; value: (r: DailyReportRow) => string | number | null }[] = [
  { header: "Name", value: (r) => r.full_name },
  { header: "BHW ID", value: (r) => r.bhw_id_number },
  { header: "Area", value: (r) => r.area },
  { header: "Date", value: (r) => r.work_date },
  { header: "Time in", value: (r) => (r.time_in ? formatTime(r.time_in) : "") },
  { header: "Time out", value: (r) => (r.time_out ? formatTime(r.time_out) : "") },
  { header: "Status", value: statusLabel },
  { header: "Minutes late", value: (r) => r.minutes_late },
  { header: "Undertime minutes", value: (r) => r.undertime_minutes },
  { header: "Method", value: (r) => (r.method ? METHOD_LABELS[r.method] : "") },
  { header: "Station", value: (r) => r.station_name },
];

const printColumns: PrintColumn<DailyReportRow>[] = [
  { header: "Name", value: (r) => r.full_name },
  { header: "BHW ID", value: (r) => r.bhw_id_number },
  { header: "Area", value: (r) => r.area },
  { header: "Time in", value: (r) => (r.time_in ? formatTime(r.time_in) : ""), align: "center" },
  { header: "Time out", value: (r) => (r.time_out ? formatTime(r.time_out) : ""), align: "center" },
  { header: "Status", value: statusLabel },
  { header: "Late (min)", value: (r) => r.minutes_late, align: "right" },
  { header: "Undertime (min)", value: (r) => r.undertime_minutes, align: "right" },
];

export function DailyReport({ rows, fileStem, caption }: { rows: DailyReportRow[]; fileStem: string; caption: string }) {
  const totals = dailyTotals(rows);
  const breakdown = `${totals.on_time} on time, ${totals.late} late, ${totals.undertime} undertime, ${totals.incomplete} no time-out, ${totals.absent} absent, ${totals.no_record} no record`;

  return (
    <div className="space-y-4">
      {rows.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <DailyStatusChart totals={totals} />
          <TotalsStrip
            label={`Totals for ${totals.employees} employees (counted from the rows below)`}
            items={[
              { label: "Present", value: totals.present },
              { label: "On time", value: totals.on_time },
              { label: "Late", value: totals.late },
              { label: "Undertime", value: totals.undertime },
              { label: "No time-out", value: totals.incomplete },
              { label: "Absent", value: totals.absent },
              { label: "No record yet", value: totals.no_record },
              { label: "Total lateness", value: formatMinutes(totals.minutes_late) },
              { label: "Total undertime", value: formatMinutes(totals.undertime_minutes) },
            ]}
          />
        </div>
      ) : null}

      <div className="print:hidden">
        <DataTable
          columns={columns}
          data={rows}
          searchPlaceholder="Search name, ID or area"
          csvFileName={fileStem}
          csv={csv}
          emptyTitle="No employees match these filters"
          emptyDescription="Try another date, area or status."
        />
      </div>

      <ReportPrintTable
        caption={caption}
        columns={printColumns}
        rows={rows}
        totals={[
          "TOTAL",
          `${totals.employees} employees`,
          null,
          `${totals.present} present`,
          null,
          breakdown,
          totals.minutes_late,
          totals.undertime_minutes,
        ]}
      />
    </div>
  );
}
