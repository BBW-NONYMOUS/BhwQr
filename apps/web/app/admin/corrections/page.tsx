import { CORRECTION_STATUSES, errorMessage, type CorrectionStatus } from "@bhw/types";
import type { Metadata } from "next";

import type { CorrectionRecordSnapshot, CorrectionRow } from "@/components/attendance/corrections-table";
import { CorrectionsTable } from "@/components/attendance/corrections-table";
import { parseCorrectionFilters } from "@/components/attendance/filters";
import { PageHeader } from "@/components/page-header";
import { ErrorState } from "@/components/states";
import { requireProfile } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Correction Requests" };

const ROW_LIMIT = 500;
/** Signed attachment links expire after 10 minutes (FR-70, private bucket). */
const SIGNED_URL_SECONDS = 600;

export default async function CorrectionsPage({ searchParams }: PageProps<"/admin/corrections">) {
  await requireProfile(["admin"]);
  const filters = parseCorrectionFilters(await searchParams);
  const supabase = await createClient();

  function countFor(status: CorrectionStatus) {
    let q = supabase.from("correction_requests").select("id", { count: "exact", head: true }).eq("status", status);
    if (filters.type) q = q.eq("type", filters.type);
    if (filters.employeeId) q = q.eq("employee_id", filters.employeeId);
    return q;
  }

  let listQuery = supabase
    .from("correction_requests")
    .select(
      `id, employee_id, work_date, type, requested_time_in, requested_time_out, reason, attachment_url,
       status, remarks, reviewed_at, created_at,
       employee:profiles!correction_requests_employee_id_fkey(full_name, bhw_id_number),
       reviewer:profiles!correction_requests_reviewed_by_fkey(full_name)`,
    )
    .eq("status", filters.status);
  if (filters.type) listQuery = listQuery.eq("type", filters.type);
  if (filters.employeeId) listQuery = listQuery.eq("employee_id", filters.employeeId);
  // Pending: oldest first (first come, first served). Reviewed: most recent decision first.
  listQuery =
    filters.status === "pending"
      ? listQuery.order("created_at", { ascending: true })
      : listQuery.order("reviewed_at", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false });

  const [list, employeesRes, ...countResults] = await Promise.all([
    listQuery.limit(ROW_LIMIT),
    supabase.from("profiles").select("id, full_name, bhw_id_number, status").eq("role", "employee").order("full_name"),
    ...CORRECTION_STATUSES.map(countFor),
  ]);

  const header = (
    <PageHeader
      title="Correction Requests"
      description="Review employees' requests to fix missing or wrong times. Approving updates the attendance record and DTR."
    />
  );

  const countError = countResults.find((r) => r.error)?.error;
  if (list.error || employeesRes.error || countError) {
    console.error("corrections page query failed", list.error ?? employeesRes.error ?? countError);
    return (
      <>
        {header}
        <ErrorState message={errorMessage("INTERNAL_ERROR", "en")} />
      </>
    );
  }

  const counts = Object.fromEntries(
    CORRECTION_STATUSES.map((s, i) => [s, countResults[i]?.count ?? 0]),
  ) as Record<CorrectionStatus, number>;

  // Current attendance records for the listed employee/date pairs (shown next to the request).
  const employeeIds = [...new Set(list.data.map((r) => r.employee_id))];
  const workDates = [...new Set(list.data.map((r) => r.work_date))];
  const recordMap = new Map<string, CorrectionRecordSnapshot>();
  if (employeeIds.length > 0) {
    const { data: records, error } = await supabase
      .from("attendance_records")
      .select("employee_id, work_date, time_in, time_out, status, minutes_late, undertime_minutes, method")
      .in("employee_id", employeeIds)
      .in("work_date", workDates);
    if (error) console.error("corrections page: attendance lookup failed", error);
    for (const r of records ?? []) {
      recordMap.set(`${r.employee_id}|${r.work_date}`, {
        time_in: r.time_in,
        time_out: r.time_out,
        status: r.status,
        minutes_late: r.minutes_late,
        undertime_minutes: r.undertime_minutes,
        method: r.method,
      });
    }
  }

  // Signed URLs for attachments in the private bucket, in one round trip.
  const paths = list.data.map((r) => r.attachment_url).filter((p): p is string => Boolean(p));
  const signed = new Map<string, string>();
  if (paths.length > 0) {
    const { data, error } = await supabase.storage
      .from("correction-attachments")
      .createSignedUrls(paths, SIGNED_URL_SECONDS);
    if (error) console.error("corrections page: signing attachments failed", error);
    for (const item of data ?? []) {
      if (item.path && item.signedUrl && !item.error) signed.set(item.path, item.signedUrl);
    }
  }

  const rows: CorrectionRow[] = list.data.map((r) => ({
    id: r.id,
    employee_id: r.employee_id,
    employee_name: r.employee?.full_name ?? "Unknown employee",
    bhw_id_number: r.employee?.bhw_id_number ?? null,
    work_date: r.work_date,
    type: r.type,
    requested_time_in: r.requested_time_in,
    requested_time_out: r.requested_time_out,
    reason: r.reason,
    attachment_path: r.attachment_url,
    attachment_url: r.attachment_url ? (signed.get(r.attachment_url) ?? null) : null,
    status: r.status,
    remarks: r.remarks,
    reviewed_at: r.reviewed_at,
    reviewer_name: r.reviewer?.full_name ?? null,
    created_at: r.created_at,
    record: recordMap.get(`${r.employee_id}|${r.work_date}`) ?? null,
  }));

  return (
    <>
      {header}
      <CorrectionsTable rows={rows} counts={counts} filters={filters} employees={employeesRes.data} />
      {list.data.length >= ROW_LIMIT ? (
        <p className="pt-3 text-sm text-muted-foreground">
          Showing the first {ROW_LIMIT} requests. Use the type or employee filter to narrow the list.
        </p>
      ) : null}
    </>
  );
}
