"use server";

import { isoDate } from "@bhw/types";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { invalid, mapConstraintError } from "@/components/setup/db-errors";
import { PH_REGULAR_HOLIDAYS, holidayFormSchema, missingHolidays } from "@/components/setup/holidays";
import { runRecompute } from "@/components/setup/recompute.server";
import type { RecomputeRange } from "@/components/setup/schedule";
import { fail, fromDbError, ok, type ActionResult } from "@/lib/actions";
import { currentProfileWithRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

const HOLIDAY_CONSTRAINTS = [
  { match: "holidays_pkey", field: "date", message: "There is already a holiday on this date." },
  { match: "holidays_name_check", field: "name", message: "Name must be 2 to 100 characters." },
] as const;

export async function addHoliday(values: unknown): Promise<ActionResult<{ date: string }>> {
  const profile = await currentProfileWithRole(["admin"]);
  if (!profile) return fail("FORBIDDEN");

  const parsed = holidayFormSchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error.issues);

  const supabase = await createClient();
  const { error } = await supabase.from("holidays").insert(parsed.data);
  if (error) return mapConstraintError(error, HOLIDAY_CONSTRAINTS);

  revalidatePath("/admin/holidays");
  return ok({ date: parsed.data.date }, `${parsed.data.name} added.`);
}

export async function deleteHoliday(date: string): Promise<ActionResult<{ date: string }>> {
  const profile = await currentProfileWithRole(["admin"]);
  if (!profile) return fail("FORBIDDEN");
  if (!isoDate.safeParse(date).success) return fail("INVALID_REQUEST");

  const supabase = await createClient();
  const { data, error } = await supabase.from("holidays").delete().eq("date", date).select("date");
  if (error) return fromDbError(error);
  if (!data || data.length === 0) return fail("NOT_FOUND");

  revalidatePath("/admin/holidays");
  return ok({ date }, "Holiday removed.");
}

const yearSchema = z.number().int();

/** Inserts the preset Philippine regular holidays of `year` that are not in the table yet. */
export async function addPresetHolidays(year: number): Promise<ActionResult<{ added: string[] }>> {
  const profile = await currentProfileWithRole(["admin"]);
  if (!profile) return fail("FORBIDDEN");
  if (!yearSchema.safeParse(year).success) return fail("INVALID_REQUEST");
  const preset = PH_REGULAR_HOLIDAYS[year];
  if (!preset) return fail("NOT_FOUND");

  const supabase = await createClient();
  const { data: existing, error: readError } = await supabase
    .from("holidays")
    .select("date")
    .gte("date", `${year}-01-01`)
    .lte("date", `${year}-12-31`);
  if (readError) return fromDbError(readError);

  const missing = missingHolidays(
    existing.map((h) => h.date),
    preset,
  );
  if (missing.length === 0) return ok({ added: [] }, `All ${year} regular holidays are already listed.`);

  // ON CONFLICT DO NOTHING keeps a concurrent add from failing the whole batch.
  const { data: inserted, error } = await supabase
    .from("holidays")
    .upsert(missing.map((h) => ({ date: h.date, name: h.name })), { onConflict: "date", ignoreDuplicates: true })
    .select("date");
  if (error) return fromDbError(error);

  revalidatePath("/admin/holidays");
  const added = (inserted ?? []).map((h) => h.date).sort();
  return ok({ added }, `${added.length} regular holiday${added.length === 1 ? "" : "s"} added for ${year}.`);
}

export async function recomputeFromHolidays(range: RecomputeRange): Promise<ActionResult<number>> {
  return runRecompute(range);
}
