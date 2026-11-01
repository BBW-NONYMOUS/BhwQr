import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { Tables, UserRole } from "@bhw/types";
import { createClient } from "@/lib/supabase/server";
import { HOME_BY_ROLE } from "./routes";

export type Profile = Tables<"profiles">;

/** Signed-in user's profile for this request (deduplicated with React cache). */
export const getProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  return data;
});

/**
 * Server Components and Server Actions call this first. Redirects when signed out, inactive,
 * or the role is not allowed. Returns the active profile.
 */
export async function requireProfile(roles?: readonly UserRole[]): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.status === "pending" || profile.status === "rejected") redirect(`/${profile.status}`);
  if (profile.status !== "active") redirect("/login?error=inactive");
  if (roles && !roles.includes(profile.role)) redirect(HOME_BY_ROLE[profile.role]);
  return profile;
}

/** Same check for Server Actions, returning null instead of redirecting. */
export async function currentProfileWithRole(roles: readonly UserRole[]): Promise<Profile | null> {
  const profile = await getProfile();
  if (!profile || profile.status !== "active" || !roles.includes(profile.role)) return null;
  return profile;
}
