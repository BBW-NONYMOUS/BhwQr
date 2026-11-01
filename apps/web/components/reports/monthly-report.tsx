"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { DataTable } from "@/components/data-table";
import { formatMinutes } from "@/lib/format";

import { MonthlyLateAbsentChart } from "./report-charts";
import { type PrintColumn, ReportPrintTable, TotalsStrip } from "./report-print";
import { type MonthlyReportRow, monthlyTotals } from "./report-utils";

const columns: ColumnDef<MonthlyReportRow, unknown>[] = [
  { accessorKey: "full_name", header: "Name", cell: ({ row }) => <span className="font-medium">{row.original.full_name}</span> },
  { accessorKey: "bhw_id_number", header: "BHW ID", cell: ({ row }) => row.original.bhw_id_number ?? "—" },
  { accessorKey: "area", header: "Area", cell: ({ row }) => row.original.area ?? "—" },
  { accessorKey: "scheduled_work_days", header: "Work days" },
  { accessorKey: "days_present", header: "Present" },
  { accessorKey: "on_time_days", header: "On time" },
  { accessorKey: "late_days", header: "Late" },
  { accessorKey: "undertime_days", header: "Undertime" },
  { accessorKey: "absent_days", header: "Absent" },
  { accessorKey: "incomplete_days", header: "No time-out" },
  { accessorKey: "total_minutes_late", header: "Late (min)" },
  { accessorKey: "total_undertime_minutes", header: "Undertime (min)" },
];

const csv: { header: string; value: (r: MonthlyReportRow) => string | number | null }[] = [
  { header: "Name", value: (r) => r.full_name },
  { header: "BHW ID", value: (r) => r.bhw_id_number },
  { header: "Area", value: (r) => r.area },
  { header: "Scheduled work days", value: (r) => r.scheduled_work_days },
  { header: "Days present", value: (r) => r.days_present },
  { header: "On time days", value: (r) => r.on_time_days },
  { header: "Late days", value: (r) => r.late_days },
  { header: "Undertime days", value: (r) => r.undertime_days },
  { header: "Absent days", value: (r) => r.absent_days },
  { header: "No time-out days", value: (r) => r.incomplete_days },
  { header: "Total minutes late", value: (r) => r.total_minutes_late },
  { header: "Total undertime minutes", value: (r) => r.total_undertime_minutes },
];

const printColumns: PrintColumn<MonthlyReportRow>[] = [
  { header: "Name", value: (r) => r.full_name },
  { header: "BHW ID", value: (r) => r.bhw_id_number },
  { header: "Area", value: (r) => r.area },
  { header: "Work days", value: (r) => r.scheduled_work_days, align: "right" },
  { header: "Present", value: (r) => r.days_present, align: "right" },
  { header: "On time", value: (r) => r.on_time_days, align: "right" },
  { header: "Late", value: (r) => r.late_days, align: "right" },
  { header: "Undertime", value: (r) => r.undertime_days, align: "right" },
  { header: "Absent", value: (r) => r.absent_days, align: "right" },
  { header: "No time-out", value: (r) => r.incomplete_days, align: "right" },
  { header: "Late (min)", value: (r) => r.total_minutes_late, align: "right" },
  { header: "Undertime (min)", value: (r) => r.total_undertime_minutes, align: "right" },
];

export function MonthlyReport({ rows, fileStem, caption }: { rows: MonthlyReportRow[]; fileStem: string; caption: string }) {
  const totals = monthlyTotals(rows);
  return (
    <div className="space-y-4">
      {rows.length > 0 ? (
        <>
          <TotalsStrip
            label={`Totals for ${totals.employees} employees (counted from the rows below)`}
            items={[
              { label: "Days present", value: totals.days_present },
              { label: "Late days", value: totals.late_days },
              { label: "Undertime days", value: totals.undertime_days },
              { label: "Absent days", value: totals.absent_days },
              { label: "No time-out days", value: totals.incomplete_days },
              { label: "Total lateness", value: formatMinutes(totals.total_minutes_late) },
            ]}
          />
          <MonthlyLateAbsentChart rows={rows} />
        </>
      ) : null}

      <div className="print:hidden">
        <DataTable
          columns={columns}
          data={rows}
          searchPlaceholder="Search name, ID or area"
          csvFileName={fileStem}
          csv={csv}
          emptyTitle="No employees match these filters"
          emptyDescription="Try another month or area."
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
          totals.scheduled_work_days,
          totals.days_present,
          totals.on_time_days,
          totals.late_days,
          totals.undertime_days,
          totals.absent_days,
          totals.incomplete_days,
          totals.total_minutes_late,
          totals.total_undertime_minutes,
        ]}
      />
    </div>
  );
}
