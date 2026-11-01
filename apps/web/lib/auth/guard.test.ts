import { describe, expect, it } from "vitest";
import { decideRoute } from "./guard";

const active = (role: "admin" | "employee" | "kiosk" | "viewer") => ({ role, status: "active" as const });

describe("decideRoute", () => {
  it("lets signed-out users open public pages only", () => {
    expect(decideRoute("/register", null, false)).toEqual({ action: "allow" });
    expect(decideRoute("/admin/employees", null, false)).toEqual({
      action: "redirect",
      to: "/login?next=%2Fadmin%2Femployees",
    });
  });

  it("keeps pending users on /pending (AC-01 for the web)", () => {
    const pending = { role: "employee" as const, status: "pending" as const };
    expect(decideRoute("/me", pending, true)).toEqual({ action: "redirect", to: "/pending" });
    expect(decideRoute("/pending", pending, true)).toEqual({ action: "allow" });
    expect(decideRoute("/privacy", pending, true)).toEqual({ action: "allow" });
    expect(decideRoute("/login", pending, true)).toEqual({ action: "redirect", to: "/pending" });
  });

  it("lets pending, rejected and active users set a new password from a reset link", () => {
    const pending = { role: "employee" as const, status: "pending" as const };
    expect(decideRoute("/login/new-password", pending, true)).toEqual({ action: "allow" });
    expect(decideRoute("/login/new-password", { ...pending, status: "rejected" }, true)).toEqual({ action: "allow" });
    expect(decideRoute("/login/new-password", active("admin"), true)).toEqual({ action: "allow" });
  });

  it("keeps rejected users on /rejected", () => {
    const rejected = { role: "employee" as const, status: "rejected" as const };
    expect(decideRoute("/me", rejected, true)).toEqual({ action: "redirect", to: "/rejected" });
  });

  it("sends inactive users back to login", () => {
    expect(decideRoute("/me", { role: "employee", status: "inactive" }, true)).toEqual({
      action: "redirect",
      to: "/login?error=inactive",
    });
  });

  it("enforces role prefixes", () => {
    expect(decideRoute("/admin", active("viewer"), true)).toEqual({ action: "redirect", to: "/viewer" });
    expect(decideRoute("/viewer", active("admin"), true)).toEqual({ action: "allow" });
    expect(decideRoute("/kiosk/abc", active("employee"), true)).toEqual({ action: "redirect", to: "/me" });
    expect(decideRoute("/kiosk/abc", active("kiosk"), true)).toEqual({ action: "allow" });
  });

  it("sends signed-in users away from login and status pages", () => {
    expect(decideRoute("/login", active("admin"), true)).toEqual({ action: "redirect", to: "/admin" });
    expect(decideRoute("/pending", active("employee"), true)).toEqual({ action: "redirect", to: "/me" });
  });
});
