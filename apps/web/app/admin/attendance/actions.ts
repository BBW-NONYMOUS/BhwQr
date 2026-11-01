"use server";

import { errorMessage, type Database } from "@bhw/types";
import { revalidatePath } from "next/cache";

import { manualEntryFormSchema, recomputeSchema, zodFieldErrors } from "@/components/attendance/schemas";
import { fail, fromDbError, ok, type ActionResult } from "@/lib/actions";
import { currentProfileWithRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

type ManualEntryArgs = Database["public"]["Functions"]["manual_attendance_entry"]["Args"];

function invalid(fieldErrors: Record<string, string>): ActionResult<never> {
  return { ok: false, code: "INVALID_REQUEST", message: errorMessage("INVALID_REQUEST", "en"), fieldErrors };
}

/**
 * Admin manual entry (FR-65, BR-60) and "Edit times" on an existing record. The SQL function
 * converts the Manila HH:mm values, recomputes status (FR-67) and writes the audit entry with
 * the reason (FR-66).
 */
export async function saveManualEntryAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  const admin = await currentProfileWithRole(["admin"]);
  if (!admin) return fail("FORBIDDEN");

  const parsed = manualEntryFormSchema.safeParse(input);
  if (!parsed.success) return invalid(zodFieldErrors(parsed.error));
  const v = parsed.data;

  const supabase = await createClient();
  // The generated Args type marks p_time_in/p_time_out as string, but the SQL function accepts
  // NULL for "leave this time unchanged" (BR-60).
  const args = {
    p_employee_id: v.employeeId,
    p_work_date: v.workDate,
    p_time_in: v.timeIn,
    p_time_out: v.timeOut,
    p_reason: v.reason,
    ...(v.stationId ? { p_station_id: v.stationId } : {}),
  } as ManualEntryArgs;
  const { data, error } = await supabase.rpc("manual_attendance_entry", args);
  if (error) return fromDbError(error);

  revalidatePath("/admin/attendance");
  revalidatePath("/admin");
  return ok({ id: data }, "Attendance saved. The change is recorded in the audit log.");
}

/** Recomputes status, minutes late and undertime for a date range (FR-106). */
export async function recomputeAttendanceAction(input: unknown): Promise<ActionResult<{ count: number }>> {
  const admin = await currentProfileWithRole(["admin"]);
  if (!admin) return fail("FORBIDDEN");

  const parsed = recomputeSchema.safeParse(input);
  if (!parsed.success) return invalid(zodFieldErrors(parsed.error));
  const v = parsed.data;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("recompute_attendance", {
    p_from: v.from,
    p_to: v.to,
    ...(v.employeeId ? { p_employee_id: v.employeeId } : {}),
  });
  if (error) return fromDbError(error);

  revalidatePath("/admin/attendance");
  revalidatePath("/admin");
  const count = data ?? 0;
  return ok(
    { count },
    count === 0 ? "All statuses were already up to date." : `Updated ${count} record${count === 1 ? "" : "s"}.`,
  );
}
