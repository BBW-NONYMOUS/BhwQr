import { errorMessage } from "@bhw/types";
import { InfoIcon } from "lucide-react";
import type { Metadata } from "next";

import { AttendanceFiltersBar } from "@/components/attendance/attendance-filters";
import { AttendanceTable, type AttendanceRow } from "@/components/attendance/attendance-table";
import {
  ATTENDANCE_ROW_LIMIT,
  attendanceEqFilters,
  parseAttendanceFilters,
} from "@/components/attendance/filters";
import { RecomputeDialog } from "@/components/attendance/recompute-dialog";
import { PageHeader } from "@/components/page-header";
import { ErrorState } from "@/components/states";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { requireProfile } from "@/lib/auth/session";
import { manilaToday } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Attendance Records" };

export default async function AttendancePage({ searchParams }: PageProps<"/admin/attendance">) {
  await requireProfile(["admin"]);
  const today = manilaToday();
  const filters = parseAttendanceFilters(await searchParams, today);
  const supabase = await createClient();

  let query = supabase
    .from("attendance_records")
    .select(
      `id, employee_id, work_date, time_in, time_out, status, minutes_late, undertime_minutes, method,
       station_id, notes,
       employee:profiles!attendance_records_employee_id_fkey(full_name, bhw_id_number),
       station:stations!attendance_records_station_id_fkey(name)`,
    )
    .gte("work_date", filters.from)
    .lte("work_date", filters.to);
  for (const [column, value] of attendanceEqFilters(filters)) {
    query = query.eq(column, value);
  }

  const [records, employeesRes, stationsRes] = await Promise.all([
    query
      .order("work_date", { ascending: false })
      .order("time_in", { ascending: false, nullsFirst: false })
      .limit(ATTENDANCE_ROW_LIMIT),
    supabase
      .from("profiles")
      .select("id, full_name, bhw_id_number, status")
      .eq("role", "employee")
      .in("status", ["active", "inactive"])
      .order("full_name"),
    supabase.from("stations").select("id, name").eq("is_active", true).order("name"),
  ]);

  const header = (
    <PageHeader
      title="Attendance Records"
      description="Every time-in and time-out with its status and how it was recorded. Times are Manila time."
      actions={
        <RecomputeDialog
          defaults={{ from: filters.from, to: filters.to, employeeId: filters.employeeId }}
          employees={employeesRes.data ?? []}
          today={today}
        />
      }
    />
  );

  if (records.error || employeesRes.error || stationsRes.error) {
    console.error("attendance page query failed", records.error ?? employeesRes.error ?? stationsRes.error);
    return (
      <>
        {header}
        <ErrorState message={errorMessage("INTERNAL_ERROR", "en")} />
      </>
    );
  }

  const rows: AttendanceRow[] = records.data.map((r) => ({
    id: r.id,
    employee_id: r.employee_id,
    employee_name: r.employee?.full_name ?? "Unknown employee",
    bhw_id_number: r.employee?.bhw_id_number ?? null,
    work_date: r.work_date,
    time_in: r.time_in,
    time_out: r.time_out,
    status: r.status,
    minutes_late: r.minutes_late,
    undertime_minutes: r.undertime_minutes,
    method: r.method,
    station_id: r.station_id,
    station_name: r.station?.name ?? null,
    notes: r.notes,
  }));
  const capped = rows.length >= ATTENDANCE_ROW_LIMIT;
  if (capped) {
    console.info(`attendance page: showing first ${ATTENDANCE_ROW_LIMIT} rows for`, filters);
  }

  return (
    <>
      {header}
      <AttendanceFiltersBar filters={filters} employees={employeesRes.data} today={today} />
      {capped ? (
        <Alert className="mb-4">
          <InfoIcon />
          <AlertDescription>
            Showing the first {ATTENDANCE_ROW_LIMIT.toLocaleString("en-PH")} records (newest first). Narrow the date
            range or pick an employee to see the rest; the CSV export also includes only these rows.
          </AlertDescription>
        </Alert>
      ) : null}
      <AttendanceTable
        rows={rows}
        employees={employeesRes.data}
        stations={stationsRes.data}
        today={today}
        csvFileName={`attendance_${filters.from}_${filters.to}`}
      />
    </>
  );
}
