"use server";

import { revalidatePath } from "next/cache";

import { invalid, mapConstraintError } from "@/components/setup/db-errors";
import { settingsFormSchema, type SettingsFormValues } from "@/components/setup/settings";
import { fail, ok, type ActionResult } from "@/lib/actions";
import { currentProfileWithRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

const SETTINGS_CONSTRAINTS = [
  {
    match: "app_settings_refresh_lt_lifetime",
    field: "token_refresh_seconds",
    message: "Refresh interval must be shorter than the token lifetime.",
  },
  { match: "geofence_radius_m", field: "geofence_radius_m", message: "Must be between 10 and 1000 m." },
  { match: "max_gps_accuracy_m", field: "max_gps_accuracy_m", message: "Must be between 5 and 200 m." },
  { match: "cooldown_minutes", field: "cooldown_minutes", message: "Must be between 1 and 60 minutes." },
  { match: "token_lifetime_seconds", field: "token_lifetime_seconds", message: "Must be between 15 and 120 s." },
  { match: "token_refresh_seconds", field: "token_refresh_seconds", message: "Must be between 5 and 60 s." },
  { match: "selfie_retention_days", field: "selfie_retention_days", message: "Must be between 1 and 365 days." },
  { match: "overnight_cutoff_hour", field: "overnight_cutoff_hour", message: "Must be between 0 and 6." },
  { match: "correction_window_days", field: "correction_window_days", message: "Must be between 0 and 15 days." },
  {
    match: "heartbeat_interval_seconds",
    field: "heartbeat_interval_seconds",
    message: "Must be between 30 and 300 s.",
  },
] as const;

export async function updateSettings(values: unknown): Promise<ActionResult<SettingsFormValues>> {
  const profile = await currentProfileWithRole(["admin"]);
  if (!profile) return fail("FORBIDDEN");

  const parsed = settingsFormSchema.safeParse(values);
  if (!parsed.success) return invalid(parsed.error.issues);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("app_settings")
    .update({ ...parsed.data, updated_by: profile.id })
    .eq("id", 1)
    .select("id")
    .maybeSingle();

  if (error) return mapConstraintError(error, SETTINGS_CONSTRAINTS);
  // RLS hides the row from non-admins, so an update that matched nothing means no permission.
  if (!data) return fail("FORBIDDEN");

  // Settings feed the kiosk, stations (default radius), device health and every report header.
  revalidatePath("/admin", "layout");
  return ok(parsed.data, "Settings saved. Kiosks and phones pick up the new values on their next refresh.");
}
