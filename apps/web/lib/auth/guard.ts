import type { ProfileStatus, UserRole } from "@bhw/types";
import { HOME_BY_ROLE, routeAccessFor } from "./routes";

export interface GuardProfile {
  role: UserRole;
  status: ProfileStatus;
}

export type GuardDecision = { action: "allow" } | { action: "redirect"; to: string };

const AUTH_ENTRY = new Set(["/login", "/register"]);
/** Opened from a password-reset link; any signed-in, non-inactive account may set a new password. */
const PASSWORD_RESET = "/login/new-password";

/**
 * Pure route decision used by proxy.ts (docs/phase-4-web/README.md §3).
 * `profile` is null when the user is signed out or has no profile row.
 */
export function decideRoute(pathname: string, profile: GuardProfile | null, signedIn: boolean): GuardDecision {
  const access = routeAccessFor(pathname);

  if (!signedIn) {
    if (access.kind === "public") return { action: "allow" };
    return { action: "redirect", to: `/login?next=${encodeURIComponent(pathname)}` };
  }

  if (!profile) {
    return access.kind === "public" ? { action: "allow" } : { action: "redirect", to: "/login?error=profile" };
  }

  if (profile.status === "inactive") {
    return pathname === "/login" ? { action: "allow" } : { action: "redirect", to: "/login?error=inactive" };
  }

  if (profile.status === "pending" || profile.status === "rejected") {
    const statusPage = `/${profile.status}`;
    if (pathname === statusPage || pathname === PASSWORD_RESET) return { action: "allow" };
    if (access.kind === "public" && !AUTH_ENTRY.has(pathname) && pathname !== "/") return { action: "allow" };
    return { action: "redirect", to: statusPage };
  }

  const home = HOME_BY_ROLE[profile.role];
  if (AUTH_ENTRY.has(pathname) || access.kind === "status") return { action: "redirect", to: home };
  if (access.kind === "role" && !access.roles.includes(profile.role)) return { action: "redirect", to: home };
  return { action: "allow" };
}
