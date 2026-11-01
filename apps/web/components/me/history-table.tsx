"use client";

import type { Database } from "@bhw/types";
import type { ColumnDef } from "@tanstack/react-table";
import { ClockAlertIcon } from "lucide-react";

import { DataTable } from "@/components/data-table";
import { MethodBadge } from "@/components/method-badge";
import { StatusBadge } from "@/components/status-badge";
import { formatDate, formatMinutes, formatTime } from "@/lib/format";

export type HistoryRow = Database["public"]["Functions"]["get_employee_history"]["Returns"][number];

const columns: ColumnDef<HistoryRow, unknown>[] = [
  {
    accessorKey: "work_date",
    header: "Date · Petsa",
    cell: ({ row }) => <span className="whitespace-nowrap">{formatDate(row.original.work_date)}</span>,
  },
  {
    accessorKey: "time_in",
    header: "Time in",
    cell: ({ row }) => formatTime(row.original.time_in),
  },
  {
    accessorKey: "time_out",
    header: "Time out",
    cell: ({ row }) => formatTime(row.original.time_out),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <span className="flex flex-wrap items-center gap-1.5">
        <StatusBadge status={row.original.status} />
        {row.original.pending_correction ? (
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <ClockAlertIcon className="size-3.5" aria-hidden />
            Correction pending
          </span>
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
    cell: ({ row }) =>
      row.original.undertime_minutes > 0 ? formatMinutes(row.original.undertime_minutes) : "—",
  },
  {
    accessorKey: "method",
    header: "Method",
    enableSorting: false,
    cell: ({ row }) => <MethodBadge method={row.original.method} />,
  },
];

/** This month's records (get_employee_history), newest first. */
export function HistoryTable({ rows }: { rows: HistoryRow[] }) {
  return (
    <DataTable
      columns={columns}
      data={rows}
      pageSize={31}
      emptyTitle="No records this month yet"
      emptyDescription="Your time-ins and time-outs appear here after you scan the kiosk QR. · Wala pang record ngayong buwan."
    />
  );
}
