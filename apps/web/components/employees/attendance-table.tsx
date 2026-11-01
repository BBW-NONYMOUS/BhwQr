"use client";

import type { AttendanceMethod, AttendanceStatus } from "@bhw/types";
import type { ColumnDef } from "@tanstack/react-table";

import { DataTable } from "@/components/data-table";
import { MethodBadge } from "@/components/method-badge";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatMinutes, formatTime } from "@/lib/format";

export interface AttendanceRow {
  id: string;
  work_date: string;
  time_in: string | null;
  time_out: string | null;
  status: AttendanceStatus;
  minutes_late: number;
  undertime_minutes: number;
  method: AttendanceMethod;
  station_name: string | null;
  pending_correction: boolean;
}

const columns: ColumnDef<AttendanceRow, unknown>[] = [
  { accessorKey: "work_date", header: "Date", cell: ({ row }) => formatDate(row.original.work_date) },
  { accessorKey: "time_in", header: "Time in", cell: ({ row }) => formatTime(row.original.time_in) },
  { accessorKey: "time_out", header: "Time out", cell: ({ row }) => formatTime(row.original.time_out) },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <span className="inline-flex flex-wrap items-center gap-1.5">
        <StatusBadge status={row.original.status} />
        {row.original.pending_correction ? (
          <Badge variant="outline" className="rounded-full">
            Correction pending
          </Badge>
        ) : null}
      </span>
    ),
  },
  {
    accessorKey: "minutes_late",
    header: "Late",
    cell: ({ row }) => (row.original.minutes_late > 0 ? formatMinutes(row.original.minutes_late) : "—"),
  },
  {
    accessorKey: "undertime_minutes",
    header: "Undertime",
    cell: ({ row }) => (row.original.undertime_minutes > 0 ? formatMinutes(row.original.undertime_minutes) : "—"),
  },
  { accessorKey: "method", header: "Method", cell: ({ row }) => <MethodBadge method={row.original.method} /> },
  { accessorKey: "station_name", header: "Station", cell: ({ row }) => row.original.station_name ?? "—" },
];

/** Last 30 days of attendance on the employee detail page (FR-12). Times are Manila. */
export function EmployeeAttendanceTable({ rows }: { rows: AttendanceRow[] }) {
  return (
    <DataTable
      columns={columns}
      data={rows}
      pageSize={10}
      emptyTitle="No attendance in the last 30 days"
      emptyDescription="Scans, manual entries and approved corrections appear here."
    />
  );
}
