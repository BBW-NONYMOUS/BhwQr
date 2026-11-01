"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { invalid, mapConstraintError } from "@/components/setup/db-errors";
import { roundCoord, stationFormSchema } from "@/components/setup/station";
import { fail, ok, type ActionResult } from "@/lib/actions";
import { currentProfileWithRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

const STATION_CONSTRAINTS = [
  { match: "stations_name_key", field: "name", message: "A station with this name already exists." },
  {
    match: "stations_kiosk_user_id_key",
    field: "kioskUserId",
    message: "This kiosk account is already linked to another station.",
  },
  { match: "radius_m", field: "radiusM", message: "Radius must be between 10 and 1000 m." },
  { match: "latitude", field: "latitude", message: "Latitude must be between -90 and 90." },
  { match: "longitude", field: "longitude", message: "Longitude must be between -180 and 180." },
] as const;

const idSchema = z.uuid();

export async function saveStation(input: { id: string | null; values: unknown }): Promise<ActionResult<{ id: string }>> {
  const profile = await currentProfileWithRole(["admin"]);
  if (!profile) return fail("FORBIDDEN");

  const parsed = stationFormSchema.safeParse(input.values);
  if (!parsed.success) return invalid(parsed.error.issues);
  if (input.id !== null && !idSchema.safeParse(input.id).success) return fail("INVALID_REQUEST");

  const v = parsed.data;
  const row = {
    name: v.name,
    latitude: roundCoord(v.latitude),
    longitude: roundCoord(v.longitude),
    radius_m: v.radiusM,
    is_active: v.isActive,
    kiosk_user_id: v.kioskUserId,
  };

  const supabase = await createClient();
  const { data, error } = input.id
    ? await supabase.from("stations").update(row).eq("id", input.id).select("id").maybeSingle()
    : await supabase.from("stations").insert(row).select("id").single();

  if (error) {
    // check_station_kiosk_user() trigger: the chosen profile is not a kiosk account.
    if (error.message?.includes("role kiosk")) {
      const message = "Choose an account with the kiosk role.";
      return { ok: false, code: "INVALID_REQUEST", message, fieldErrors: { kioskUserId: message } };
    }
    return mapConstraintError(error, STATION_CONSTRAINTS);
  }
  if (!data) return fail("NOT_FOUND");

  revalidatePath("/admin/stations");
  revalidatePath("/admin/device-health");
  return ok({ id: data.id }, input.id ? "Station updated." : "Station created.");
}
