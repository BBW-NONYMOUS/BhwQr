import "server-only";

import { revalidatePath } from "next/cache";

import { fail, fromDbError, ok, type ActionResult } from "@/lib/actions";
import { currentProfileWithRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

import { invalid } from "./db-errors";
import { recomputeRangeSchema } from "./schedule";

/**
 * Shared body of the "Recompute statuses" Server Actions (Schedules and Holidays). Calls
 * recompute_attendance with the admin's own JWT; the RPC re-checks assert_admin() and audits.
 */
export async function runRecompute(input: unknown): Promise<ActionResult<number>> {
  const profile = await currentProfileWithRole(["admin"]);
  if (!profile) return fail("FORBIDDEN");

  const parsed = recomputeRangeSchema.safeParse(input);
  if (!parsed.success) return invalid(parsed.error.issues);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("recompute_attendance", {
    p_from: parsed.data.from,
    p_to: parsed.data.to,
  });
  if (error) return fromDbError(error);
  // Attendance, dashboard, DTR and reports all read the recomputed rows.
  revalidatePath("/admin", "layout");
  return ok(data ?? 0);
}
