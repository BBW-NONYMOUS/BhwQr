import "server-only";
import { redirect } from "next/navigation";

import { getProfile, type Profile } from "@/lib/auth/session";
import { HOME_BY_ROLE } from "@/lib/auth/routes";

/**
 * Status pages cannot use requireProfile (it redirects pending/rejected users to these very
 * pages). Loads the profile and sends anyone whose status does not match to the right place.
 */
export async function profileForStatusPage(expected: "pending" | "rejected"): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect(`/login?next=/${expected}`);
  if (profile.status === expected) return profile;
  if (profile.status === "pending" || profile.status === "rejected") redirect(`/${profile.status}`);
  if (profile.status === "inactive") redirect("/login?error=inactive");
  redirect(HOME_BY_ROLE[profile.role]);
}
