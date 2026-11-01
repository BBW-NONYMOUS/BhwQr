"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { invalid, mapConstraintError } from "@/components/setup/db-errors";
import { runRecompute } from "@/components/setup/recompute.server";
import { normalizeWorkDays, scheduleFormSchema, type RecomputeRange } from "@/components/setup/schedule";
import { fail, fromDbError, ok, type ActionResult } from "@/lib/actions";
import { currentProfileWithRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

const SCHEDULE_CONSTRAINTS = [
  { match: "schedules_name_key", field: "name", message: "A schedule with this name already exists." },
  { match: "schedules_time_order", field: "endTime", message: "End time must be later than start time." },
  { match: "schedules_break_inside", field: "breakStart", message: "The break must be inside work hours." },
  { match: "schedules_work_days", field: "workDays", message: "Choose at least one work day (Mon–Sun)." },
  { match: "grace_minutes", field: "graceMinutes", message: "Grace period must be 0 to 60 minutes." },
] as const;

const idSchema = z.uuid();

export async function saveSchedule(input: { id: string | null; values: unknown }): Promise<ActionResult<{ id: string }>> {
  const profile = await currentProfileWithRole(["admin"]);
  if (!profile) return fail("FORBIDDEN");

  const parsed = scheduleFormSchema.safeParse(input.values);
  if (!parsed.success) return invalid(parsed.error.issues);
  if (input.id !== null && !idSchema.safeParse(input.id).success) return fail("INVALID_REQUEST");

  const v = parsed.data;
  const row = {
    name: v.name,
    work_days: normalizeWorkDays(v.workDays),
    start_time: v.startTime,
    end_time: v.endTime,
    break_start: v.breakStart,
    break_end: v.breakEnd,
    grace_minutes: v.graceMinutes,
  };

  const supabase = await createClient();
  const { data, error } = input.id
    ? await supabase.from("schedules").update(row).eq("id", input.id).select("id").maybeSingle()
    : await supabase
        .from("schedules")
        .insert({ ...row, created_by: profile.id })
        .select("id")
        .single();

  if (error) return mapConstraintError(error, SCHEDULE_CONSTRAINTS);
  if (!data) return fail("NOT_FOUND");

  revalidatePath("/admin/schedules");
  return ok({ id: data.id }, input.id ? "Schedule updated." : "Schedule created.");
}

export async function deleteSchedule(id: string): Promise<ActionResult<undefined>> {
  const profile = await currentProfileWithRole(["admin"]);
  if (!profile) return fail("FORBIDDEN");
  if (!idSchema.safeParse(id).success) return fail("INVALID_REQUEST");

  const supabase = await createClient();
  // The delete trigger raises SCHEDULE_IN_USE when the schedule was ever assigned (BR-52).
  const { data, error } = await supabase.from("schedules").delete().eq("id", id).select("id");
  if (error) return fromDbError(error);
  if (!data || data.length === 0) return fail("NOT_FOUND");

  revalidatePath("/admin/schedules");
  return ok(undefined, "Schedule deleted.");
}

export async function recomputeFromSchedules(range: RecomputeRange): Promise<ActionResult<number>> {
  return runRecompute(range);
}
