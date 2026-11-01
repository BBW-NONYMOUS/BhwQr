"use client";

import type { AttendanceMethod, AttendanceStatus } from "@bhw/types";
import { METHOD_LABELS } from "@bhw/types";
import { statusColors } from "@bhw/design-tokens";
import type { ColumnDef } from "@tanstack/react-table";
import { ClipboardPenIcon, PencilIcon } from "lucide-react";
import { useState } from "react";

import { DataTable } from "@/components/data-table";
import { MethodBadge } from "@/components/method-badge";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { formatDate, formatMinutes, formatTime } from "@/lib/format";

import { toManilaHHmm } from "./filters";
import { ManualEntryDialog, type EmployeeOption, type StationOption } from "./manual-entry-dialog";
import type { ManualEntryFormInput } from "./schemas";

export interface AttendanceRow {
  id: string;
  employee_id: string;
  employee_name: string;
  bhw_id_number: string | null;
  work_date: string;
  time_in: string | null;
  time_out: string | null;
  status: AttendanceStatus;
  minutes_late: number;
  undertime_minutes: number;
  method: AttendanceMethod;
  station_id: string | null;
  station_name: string | null;
  notes: string | null;
}

interface DialogState {
  key: number;
  mode: "create" | "edit";
  initial?: Partial<ManualEntryFormInput>;
  context?: string;
}

/** Attendance Records table with "Manual entry" and per-row "Edit times" (FR-65, FR-66). */
export function AttendanceTable({
  rows,
  employees,
  stations,
  today,
  csvFileName,
}: {
  rows: AttendanceRow[];
  employees: EmployeeOption[];
  stations: StationOption[];
  today: string;
  csvFileName: string;
}) {
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [open, setOpen] = useState(false);

  function openCreate() {
    setDialog({ key: Date.now(), mode: "create" });
    setOpen(true);
  }

  function openEdit(row: AttendanceRow) {
    setDialog({
      key: Date.now(),
      mode: "edit",
      initial: {
        employeeId: row.employee_id,
        workDate: row.work_date,
        timeIn: toManilaHHmm(row.time_in),
        timeOut: toManilaHHmm(row.time_out),
        stationId: row.station_id,
        reason: "",
      },
      context: `${row.employee_name} · ${formatDate(row.work_date)}. The new times replace the recorded ones and the method becomes "Manual entry".`,
    });
    setOpen(true);
  }

  const columns: ColumnDef<AttendanceRow, unknown>[] = [
    {
      accessorKey: "work_date",
      header: "Date",
      cell: ({ row }) => <span className="whitespace-nowrap">{formatDate(row.original.work_date)}</span>,
    },
    {
      id: "employee",
      accessorFn: (r) => `${r.employee_name} ${r.bhw_id_number ?? ""}`,
      header: "Employee",
      cell: ({ row }) => (
        <div className="min-w-40">
          <div className="font-medium">{row.original.employee_name}</div>
          {row.original.bhw_id_number ? (
            <div className="text-xs text-muted-foreground">{row.original.bhw_id_number}</div>
          ) : null}
        </div>
      ),
    },
    { accessorKey: "time_in", header: "Time in", cell: ({ row }) => formatTime(row.original.time_in) },
    { accessorKey: "time_out", header: "Time out", cell: ({ row }) => formatTime(row.original.time_out) },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <StatusBadge status={row.original.status} />,
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
    {
      accessorKey: "method",
      header: "Method",
      cell: ({ row }) => <MethodBadge method={row.original.method} />,
    },
    {
      accessorKey: "station_name",
      header: "Station",
      cell: ({ row }) => row.original.station_name ?? "—",
    },
    {
      accessorKey: "notes",
      header: "Notes",
      enableSorting: false,
      cell: ({ row }) =>
        row.original.notes ? (
          <span className="line-clamp-2 block max-w-64 text-muted-foreground" title={row.original.notes}>
            {row.original.notes}
          </span>
        ) : (
          "—"
        ),
    },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      enableSorting: false,
      cell: ({ row }) =>
        row.original.status === "absent" && !row.original.time_in ? (
          <Button variant="ghost" size="sm" onClick={() => openEdit(row.original)}>
            <ClipboardPenIcon data-icon="inline-start" aria-hidden />
            Enter times<span className="sr-only"> for {row.original.employee_name}</span>
          </Button>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => openEdit(row.original)}>
            <PencilIcon data-icon="inline-start" aria-hidden />
            Edit times<span className="sr-only"> for {row.original.employee_name}</span>
          </Button>
        ),
    },
  ];

  return (
    <>
      <DataTable
        columns={columns}
        data={rows}
        searchPlaceholder="Search name, BHW ID, station, notes"
        csvFileName={csvFileName}
        csv={[
          { header: "Work date", value: (r) => r.work_date },
          { header: "Employee", value: (r) => r.employee_name },
          { header: "BHW ID", value: (r) => r.bhw_id_number },
          { header: "Time in", value: (r) => (r.time_in ? formatTime(r.time_in) : "") },
          { header: "Time out", value: (r) => (r.time_out ? formatTime(r.time_out) : "") },
          { header: "Status", value: (r) => statusColors[r.status].label },
          { header: "Minutes late", value: (r) => r.minutes_late },
          { header: "Undertime minutes", value: (r) => r.undertime_minutes },
          { header: "Method", value: (r) => METHOD_LABELS[r.method] },
          { header: "Station", value: (r) => r.station_name },
          { header: "Notes", value: (r) => r.notes },
        ]}
        toolbar={
          <Button onClick={openCreate} className="sm:ml-auto">
            <ClipboardPenIcon data-icon="inline-start" aria-hidden />
            Manual entry
          </Button>
        }
        emptyTitle="No attendance records for these filters"
        emptyDescription="Try a wider date range, or add a manual entry for an employee who could not scan."
      />
      {dialog ? (
        <ManualEntryDialog
          key={dialog.key}
          open={open}
          onOpenChange={setOpen}
          employees={employees}
          stations={stations}
          today={today}
          mode={dialog.mode}
          initial={dialog.initial}
          context={dialog.context}
        />
      ) : null}
    </>
  );
}
