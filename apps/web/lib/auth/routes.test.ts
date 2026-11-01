import { describe, expect, it } from "vitest";
import {
  HOME_BY_ROLE,
  isPublicRoute,
  isStatusRoute,
  requiredRolesFor,
  routeAccessFor,
} from "./routes";

describe("requiredRolesFor", () => {
  it.each(["/", "/login", "/register", "/privacy", "/auth/callback"])(
    "returns null for public route %s",
    (path) => {
      expect(requiredRolesFor(path)).toBeNull();
      expect(isPublicRoute(path)).toBe(true);
    },
  );

  it.each(["/pending", "/rejected"])("returns null for status route %s", (path) => {
    expect(requiredRolesFor(path)).toBeNull();
    expect(isStatusRoute(path)).toBe(true);
    expect(routeAccessFor(path).kind).toBe("status");
  });

  it("requires admin for /admin and nested paths", () => {
    expect(requiredRolesFor("/admin")).toEqual(["admin"]);
    expect(requiredRolesFor("/admin/employees/123")).toEqual(["admin"]);
  });

  it("allows viewer and admin on /viewer", () => {
    expect(requiredRolesFor("/viewer/reports")).toEqual(["viewer", "admin"]);
  });

  it("requires employee for /me", () => {
    expect(requiredRolesFor("/me")).toEqual(["employee"]);
    expect(requiredRolesFor("/me/dtr")).toEqual(["employee"]);
  });

  it("allows kiosk and admin on /kiosk/[stationId]", () => {
    expect(requiredRolesFor("/kiosk/abc-123")).toEqual(["kiosk", "admin"]);
  });

  it("does not match look-alike prefixes", () => {
    expect(requiredRolesFor("/administrator")).toBeNull();
    expect(requiredRolesFor("/media")).toBeNull();
    expect(routeAccessFor("/administrator").kind).toBe("authenticated");
  });

  it("ignores trailing slashes, query strings and hashes", () => {
    expect(requiredRolesFor("/admin/")).toEqual(["admin"]);
    expect(requiredRolesFor("/me?month=2026-10")).toEqual(["employee"]);
    expect(isPublicRoute("/login/")).toBe(true);
    expect(isPublicRoute("/login#form")).toBe(true);
  });

  it("does not treat nested public paths as public", () => {
    expect(isPublicRoute("/login/extra")).toBe(false);
    expect(routeAccessFor("/login/extra").kind).toBe("authenticated");
  });

  it("sends each role home to a route that role may open", () => {
    for (const [role, home] of Object.entries(HOME_BY_ROLE)) {
      const roles = requiredRolesFor(home);
      expect(roles).not.toBeNull();
      expect(roles).toContain(role);
    }
  });
});
