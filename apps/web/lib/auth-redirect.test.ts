import { describe, expect, it } from "vitest";
import { isLoginErrorCode, postLoginDestination, safeNext } from "./auth-redirect";

describe("safeNext", () => {
  it("keeps same-site relative paths with query and hash", () => {
    expect(safeNext("/me")).toBe("/me");
    expect(safeNext("/admin/dtr?month=11#top")).toBe("/admin/dtr?month=11#top");
    expect(safeNext("/pending")).toBe("/pending");
  });

  it("normalises dot segments without leaving the site", () => {
    expect(safeNext("/admin/../me")).toBe("/me");
  });

  it.each([
    "https://evil.example",
    "//evil.example",
    "//evil.example/path",
    "/\\evil.example",
    "\\\\evil.example",
    "javascript:alert(1)",
    "me",
    "",
    "   ",
    "/\tevil",
  ])("rejects %j", (value) => {
    expect(safeNext(value, "/fallback")).toBe("/fallback");
  });

  it("keeps percent-encoded characters as part of the path", () => {
    expect(safeNext("/%0a")).toBe("/%0a");
  });

  it("rejects non-strings", () => {
    expect(safeNext(undefined)).toBe("/");
    expect(safeNext(null, "/x")).toBe("/x");
    expect(safeNext(["/me"], "/x")).toBe("/x");
  });

  it("rejects very long values", () => {
    expect(safeNext(`/${"a".repeat(3000)}`, "/x")).toBe("/x");
  });
});

describe("postLoginDestination", () => {
  it("reports a missing profile", () => {
    expect(postLoginDestination(null)).toEqual({ kind: "error", code: "profile" });
  });

  it("reports an inactive account", () => {
    expect(postLoginDestination({ role: "employee", status: "inactive" })).toEqual({
      kind: "error",
      code: "inactive",
    });
  });

  it("sends pending and rejected users to their status page, ignoring next", () => {
    expect(postLoginDestination({ role: "employee", status: "pending" }, "/me")).toEqual({
      kind: "redirect",
      to: "/pending",
    });
    expect(postLoginDestination({ role: "employee", status: "rejected" })).toEqual({
      kind: "redirect",
      to: "/rejected",
    });
  });

  it("sends active users to their role home by default", () => {
    expect(postLoginDestination({ role: "admin", status: "active" })).toEqual({
      kind: "redirect",
      to: "/admin",
    });
    expect(postLoginDestination({ role: "viewer", status: "active" })).toEqual({
      kind: "redirect",
      to: "/viewer",
    });
    expect(postLoginDestination({ role: "employee", status: "active" })).toEqual({
      kind: "redirect",
      to: "/me",
    });
    expect(postLoginDestination({ role: "kiosk", status: "active" })).toEqual({
      kind: "redirect",
      to: "/kiosk",
    });
  });

  it("honours a safe next path the role may open", () => {
    expect(
      postLoginDestination({ role: "admin", status: "active" }, "/admin/dtr?month=11"),
    ).toEqual({
      kind: "redirect",
      to: "/admin/dtr?month=11",
    });
    expect(postLoginDestination({ role: "admin", status: "active" }, "/viewer")).toEqual({
      kind: "redirect",
      to: "/viewer",
    });
  });

  it("ignores next when the role may not open it, or it is unsafe or an entry page", () => {
    expect(postLoginDestination({ role: "employee", status: "active" }, "/admin")).toEqual({
      kind: "redirect",
      to: "/me",
    });
    expect(postLoginDestination({ role: "employee", status: "active" }, "//evil.example")).toEqual({
      kind: "redirect",
      to: "/me",
    });
    expect(postLoginDestination({ role: "viewer", status: "active" }, "/login")).toEqual({
      kind: "redirect",
      to: "/viewer",
    });
  });
});

describe("isLoginErrorCode", () => {
  it("accepts only known codes", () => {
    expect(isLoginErrorCode("inactive")).toBe(true);
    expect(isLoginErrorCode("profile")).toBe(true);
    expect(isLoginErrorCode("link")).toBe(true);
    expect(isLoginErrorCode("other")).toBe(false);
    expect(isLoginErrorCode(undefined)).toBe(false);
  });
});
