import type { UserRole } from "@bhw/types";

/**
 * Single source of truth for web route access rules.
 * The proxy (proxy.ts) and server layouts consult this map; RLS remains the real security boundary.
 */

/** Routes anyone may open, signed in or not. Matched exactly. */
export const PUBLIC_ROUTES = ["/", "/login", "/register", "/privacy", "/auth/callback"] as const;

/** Routes for signed-in users whose account is not active yet (pending approval / rejected). */
export const STATUS_ROUTES = ["/pending", "/rejected"] as const;

/** Role-gated route prefixes. A prefix matches the path itself and every nested path. */
export const ROLE_ROUTES = {
  "/admin": ["admin"],
  "/viewer": ["viewer", "admin"],
  "/me": ["employee"],
  "/kiosk": ["kiosk", "admin"],
} as const satisfies Record<string, readonly UserRole[]>;

export type PublicRoute = (typeof PUBLIC_ROUTES)[number];
export type StatusRoute = (typeof STATUS_ROUTES)[number];
export type RoleRoutePrefix = keyof typeof ROLE_ROUTES;

export type RouteAccess =
  | { kind: "public" }
  | { kind: "status" }
  | { kind: "role"; prefix: RoleRoutePrefix; roles: readonly UserRole[] }
  | { kind: "authenticated" };

function normalize(pathname: string): string {
  const path = pathname.split(/[?#]/)[0] ?? "/";
  if (path.length > 1 && path.endsWith("/")) return path.replace(/\/+$/, "") || "/";
  return path || "/";
}

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isPublicRoute(pathname: string): boolean {
  return (PUBLIC_ROUTES as readonly string[]).includes(normalize(pathname));
}

export function isStatusRoute(pathname: string): boolean {
  const path = normalize(pathname);
  return STATUS_ROUTES.some((route) => matchesPrefix(path, route));
}

/** Classifies a pathname. Unknown routes default to "authenticated" (signed in, any active role). */
export function routeAccessFor(pathname: string): RouteAccess {
  const path = normalize(pathname);
  if (isPublicRoute(path)) return { kind: "public" };
  if (isStatusRoute(path)) return { kind: "status" };
  for (const prefix of Object.keys(ROLE_ROUTES) as RoleRoutePrefix[]) {
    if (matchesPrefix(path, prefix)) return { kind: "role", prefix, roles: ROLE_ROUTES[prefix] };
  }
  return { kind: "authenticated" };
}

/**
 * Roles allowed to open `pathname`.
 * - `null`: no role requirement (public or status routes, or any signed-in user for unknown routes).
 * - non-empty array: the signed-in user's role must be one of these.
 */
export function requiredRolesFor(pathname: string): readonly UserRole[] | null {
  const access = routeAccessFor(pathname);
  return access.kind === "role" ? access.roles : null;
}

/** Where each role lands after sign-in. */
export const HOME_BY_ROLE: Record<UserRole, string> = {
  admin: "/admin",
  viewer: "/viewer",
  employee: "/me",
  kiosk: "/kiosk",
};
