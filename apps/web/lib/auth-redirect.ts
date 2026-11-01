import type { ProfileStatus, UserRole } from "@bhw/types";
import { decideRoute } from "@/lib/auth/guard";
import { HOME_BY_ROLE } from "@/lib/auth/routes";

/**
 * Pure helpers for where to send a user after sign-in, e-mail verification or password reset.
 * Used by the login Server Action and the /auth/callback route handler.
 */

const PLACEHOLDER_ORIGIN = "http://bhw.invalid";

/**
 * Returns `value` only when it is a same-site relative path ("/me", "/admin/dtr?month=11").
 * Anything else (absolute URLs, protocol-relative "//evil.com", backslash tricks, control
 * characters, non-strings) returns `fallback`. Prevents open redirects through `?next=`.
 */
export function safeNext(value: unknown, fallback = "/"): string {
  if (typeof value !== "string") return fallback;
  const candidate = value.trim();
  if (!candidate.startsWith("/") || candidate.startsWith("//")) return fallback;
  // Browsers treat "\" like "/" ("/\evil.com" is protocol-relative) and strip tabs/newlines.
  if (candidate.includes("\\") || /[\u0000-\u001f\u007f]/.test(candidate)) return fallback;
  if (candidate.length > 2048) return fallback;

  let url: URL;
  try {
    url = new URL(candidate, PLACEHOLDER_ORIGIN);
  } catch {
    return fallback;
  }
  if (url.origin !== PLACEHOLDER_ORIGIN) return fallback;
  return `${url.pathname}${url.search}${url.hash}`;
}

export interface PostLoginProfile {
  role: UserRole;
  status: ProfileStatus;
}

/** Login page messages for `?error=` (set by proxy.ts, requireProfile and /auth/callback). */
export type LoginErrorCode = "inactive" | "profile" | "link";

export type PostLoginDestination =
  { kind: "redirect"; to: string } | { kind: "error"; code: Exclude<LoginErrorCode, "link"> };

/** Pages a signed-in user should never be "returned" to. */
const NOT_A_RETURN_TARGET = new Set(["/", "/login", "/register", "/auth/callback"]);

/**
 * Decides where a user goes right after a successful password sign-in.
 * - no profile row → error "profile"; inactive → error "inactive" (the caller signs them out);
 * - pending / rejected → their status page;
 * - active → `next` when it is a safe path this role may open, otherwise the role's home.
 */
export function postLoginDestination(
  profile: PostLoginProfile | null,
  next?: string | null,
): PostLoginDestination {
  if (!profile) return { kind: "error", code: "profile" };
  if (profile.status === "inactive") return { kind: "error", code: "inactive" };
  if (profile.status === "pending" || profile.status === "rejected") {
    return { kind: "redirect", to: `/${profile.status}` };
  }

  const home = HOME_BY_ROLE[profile.role];
  const target = safeNext(next, "");
  if (!target) return { kind: "redirect", to: home };

  const pathname = target.split(/[?#]/)[0] ?? target;
  if (NOT_A_RETURN_TARGET.has(pathname)) return { kind: "redirect", to: home };
  const decision = decideRoute(pathname, profile, true);
  return { kind: "redirect", to: decision.action === "allow" ? target : home };
}

export function isLoginErrorCode(value: unknown): value is LoginErrorCode {
  return value === "inactive" || value === "profile" || value === "link";
}

/** Bilingual text for the `?error=` codes shown above the login form. */
export const LOGIN_ERROR_TEXT: Record<LoginErrorCode, { title: string; en: string; fil: string }> =
  {
    inactive: {
      title: "Account deactivated",
      en: "Your account has been deactivated. Please contact the BHW office administrator.",
      fil: "Na-deactivate ang iyong account. Makipag-ugnayan po sa administrator ng BHW office.",
    },
    profile: {
      title: "Profile not found",
      en: "We could not find a profile for this account. Please contact the BHW office administrator.",
      fil: "Hindi po namin makita ang profile ng account na ito. Makipag-ugnayan po sa administrator ng BHW office.",
    },
    link: {
      title: "Link expired",
      en: "This link is invalid or has expired. Please log in, or ask for a new link.",
      fil: "Hindi na gumagana o nag-expire na ang link na ito. Mag-login po, o humingi ng bagong link.",
    },
  };
