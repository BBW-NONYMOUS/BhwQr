"use client";

import { statusColors } from "@bhw/design-tokens";
import { METHOD_LABELS } from "@bhw/types";
import type { ColumnDef } from "@tanstack/react-table";

import { DataTable } from "@/components/data-table";
import { MethodBadge } from "@/components/method-badge";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { formatMinutes, formatTime } from "@/lib/format";

import type { DailyRow } from "./dashboard-data";

const NOT_SCANNED = "Not yet scanned";

const columns: ColumnDef<DailyRow, unknown>[] = [
  {
    accessorKey: "full_name",
    header: "Employee",
    cell: ({ row }) => (
      <div className="min-w-40">
        <div className="font-medium">{row.original.full_name}</div>
        {row.original.bhw_id_number ? (
          <div className="text-xs text-muted-foreground">{row.original.bhw_id_number}</div>
        ) : null}
      </div>
    ),
  },
  {
    accessorKey: "area",
    header: "Area",
    cell: ({ row }) => row.original.area ?? "—",
  },
  {
    id: "status",
    accessorFn: (row) => (row.status ? statusColors[row.status].label : NOT_SCANNED),
    header: "Status",
    cell: ({ row }) =>
      row.original.status ? (
        <StatusBadge status={row.original.status} />
      ) : (
        <Badge variant="outline" className="rounded-full text-muted-foreground">
          {NOT_SCANNED}
        </Badge>
      ),
  },
  {
    accessorKey: "time_in",
    header: "Time in",
    enableGlobalFilter: false,
    cell: ({ row }) => formatTime(row.original.time_in),
  },
  {
    accessorKey: "time_out",
    header: "Time out",
    enableGlobalFilter: false,
    cell: ({ row }) => formatTime(row.original.time_out),
  },
  {
    accessorKey: "minutes_late",
    header: "Late",
    enableGlobalFilter: false,
    cell: ({ row }) => (row.original.minutes_late > 0 ? formatMinutes(row.original.minutes_late) : "—"),
  },
  {
    accessorKey: "undertime_minutes",
    header: "Undertime",
    enableGlobalFilter: false,
    cell: ({ row }) => (row.original.undertime_minutes > 0 ? formatMinutes(row.original.undertime_minutes) : "—"),
  },
  {
    id: "method",
    accessorFn: (row) => (row.method ? METHOD_LABELS[row.method] : ""),
    header: "Method",
    cell: ({ row }) => (row.original.method ? <MethodBadge method={row.original.method} /> : "—"),
  },
  {
    accessorKey: "station_name",
    header: "Station",
    cell: ({ row }) => row.original.station_name ?? "—",
  },
];

const csv: { header: string; value: (row: DailyRow) => string | number | null }[] = [
  { header: "Employee", value: (r) => r.full_name },
  { header: "BHW ID", value: (r) => r.bhw_id_number },
  { header: "Area", value: (r) => r.area },
  { header: "Date", value: (r) => r.work_date },
  { header: "Status", value: (r) => (r.status ? statusColors[r.status].label : NOT_SCANNED) },
  { header: "Time in", value: (r) => (r.time_in ? formatTime(r.time_in) : "") },
  { header: "Time out", value: (r) => (r.time_out ? formatTime(r.time_out) : "") },
  { header: "Minutes late", value: (r) => r.minutes_late },
  { header: "Undertime minutes", value: (r) => r.undertime_minutes },
  { header: "Method", value: (r) => (r.method ? METHOD_LABELS[r.method] : "") },
  { header: "Station", value: (r) => r.station_name },
];

/** Today's per-employee attendance (get_daily_summary) with search and CSV export. */
export function TodayTable({ rows, workDate }: { rows: DailyRow[]; workDate: string }) {
  return (
    <DataTable
      columns={columns}
      data={rows}
      searchPlaceholder="Search name, area, status or station"
      csvFileName={`attendance-${workDate}`}
      csv={csv}
      emptyTitle="No active employees"
      emptyDescription="Approved employees with a schedule appear here with today's status."
    />
  );
}
