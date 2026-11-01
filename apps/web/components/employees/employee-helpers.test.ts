import { describe, expect, it } from "vitest";

import {
  assignmentState,
  availableStatusActions,
  canAssignSchedule,
  canResetDevice,
  editEmployeeSchema,
  filterEmployees,
  formatClock,
  formatWorkDays,
  initials,
  isProfileStatus,
  reasonFormSchema,
  scheduleAssignmentSchema,
  shiftIsoDate,
  staffAccountSchema,
  uniqueAreas,
} from "./employee-helpers";

describe("availableStatusActions (state table §2.1)", () => {
  it("offers approve/reject only for pending employees", () => {
    expect(availableStatusActions({ role: "employee", status: "pending" })).toEqual(["approve", "reject"]);
    expect(availableStatusActions({ role: "viewer", status: "pending" })).toEqual([]);
  });

  it("offers deactivate for active accounts, except the admin's own", () => {
    expect(availableStatusActions({ role: "employee", status: "active" })).toEqual(["deactivate"]);
    expect(availableStatusActions({ role: "kiosk", status: "active" })).toEqual(["deactivate"]);
    expect(availableStatusActions({ role: "admin", status: "active" }, { isSelf: true })).toEqual([]);
  });

  it("offers reactivate for inactive accounts", () => {
    expect(availableStatusActions({ role: "employee", status: "inactive" })).toEqual(["reactivate"]);
    expect(availableStatusActions({ role: "viewer", status: "inactive" })).toEqual(["reactivate"]);
  });

  it("offers nothing for rejected registrations (rejected -> active is not allowed)", () => {
    expect(availableStatusActions({ role: "employee", status: "rejected" })).toEqual([]);
  });
});

describe("canAssignSchedule / canResetDevice", () => {
  it("assigns schedules to approved employees only", () => {
    expect(canAssignSchedule({ role: "employee", status: "active" })).toBe(true);
    expect(canAssignSchedule({ role: "employee", status: "inactive" })).toBe(true);
    expect(canAssignSchedule({ role: "employee", status: "pending" })).toBe(false);
    expect(canAssignSchedule({ role: "employee", status: "rejected" })).toBe(false);
    expect(canAssignSchedule({ role: "kiosk", status: "active" })).toBe(false);
  });

  it("resets a device only when an employee has an active binding", () => {
    expect(canResetDevice({ role: "employee" }, true)).toBe(true);
    expect(canResetDevice({ role: "employee" }, false)).toBe(false);
    expect(canResetDevice({ role: "admin" }, true)).toBe(false);
  });
});

describe("initials", () => {
  it("uses first and last word", () => {
    expect(initials("Maria dela Cruz")).toBe("MC");
    expect(initials("  ana  ")).toBe("A");
    expect(initials("")).toBe("?");
    expect(initials(null)).toBe("?");
    expect(initials("Ñora Santos")).toBe("ÑS");
  });
});

describe("shiftIsoDate", () => {
  it("adds and subtracts days across month and year boundaries", () => {
    expect(shiftIsoDate("2026-11-01", -29)).toBe("2026-10-03");
    expect(shiftIsoDate("2026-03-01", -1)).toBe("2026-02-28");
    expect(shiftIsoDate("2026-12-31", 1)).toBe("2027-01-01");
    expect(shiftIsoDate("2028-02-28", 1)).toBe("2028-02-29");
  });
});

describe("assignmentState", () => {
  const today = "2026-11-10";
  it("classifies current, upcoming and ended assignments", () => {
    expect(assignmentState({ effective_from: "2026-11-01", effective_to: null }, today)).toBe("current");
    expect(assignmentState({ effective_from: "2026-11-10", effective_to: "2026-11-10" }, today)).toBe("current");
    expect(assignmentState({ effective_from: "2026-11-11", effective_to: null }, today)).toBe("upcoming");
    expect(assignmentState({ effective_from: "2026-10-01", effective_to: "2026-11-09" }, today)).toBe("ended");
  });
});

describe("formatWorkDays / formatClock", () => {
  it("formats ISO weekday sets", () => {
    expect(formatWorkDays([1, 2, 3, 4, 5])).toBe("Mon–Fri");
    expect(formatWorkDays([5, 3, 1])).toBe("Mon, Wed, Fri");
    expect(formatWorkDays([6, 7])).toBe("Sat, Sun");
    expect(formatWorkDays([])).toBe("—");
  });
  it("trims seconds", () => {
    expect(formatClock("08:00:00")).toBe("08:00");
    expect(formatClock(null)).toBe("—");
  });
});

describe("filterEmployees / uniqueAreas", () => {
  const rows = [
    { id: "1", status: "active" as const, area: "Purok 2" },
    { id: "2", status: "pending" as const, area: "Purok 1" },
    { id: "3", status: "active" as const, area: "purok 1" },
    { id: "4", status: "inactive" as const, area: null },
  ];

  it("filters by status and area", () => {
    expect(filterEmployees(rows, { status: "all", area: "all" })).toHaveLength(4);
    expect(filterEmployees(rows, { status: "active", area: "all" }).map((r) => r.id)).toEqual(["1", "3"]);
    expect(filterEmployees(rows, { status: "all", area: "Purok 1" }).map((r) => r.id)).toEqual(["2"]);
    expect(filterEmployees(rows, { status: "pending", area: "Purok 2" })).toEqual([]);
  });

  it("lists distinct non-empty areas", () => {
    expect(uniqueAreas(rows)).toEqual(["Purok 1", "purok 1", "Purok 2"]);
  });

  it("recognises profile statuses from the query string", () => {
    expect(isProfileStatus("pending")).toBe(true);
    expect(isProfileStatus("deleted")).toBe(false);
    expect(isProfileStatus(undefined)).toBe(false);
  });
});

describe("form schemas", () => {
  it("requires a reason of at least 10 characters after trimming", () => {
    expect(reasonFormSchema.safeParse({ reason: "   too short " }).success).toBe(false);
    expect(reasonFormSchema.safeParse({ reason: "Lost phone, replaced" }).success).toBe(true);
  });

  it("upper-cases the BHW ID and requires an area", () => {
    const parsed = editEmployeeSchema.parse({ fullName: " Ana Reyes ", bhwIdNumber: "bhw-2026-014", area: "Purok 3" });
    expect(parsed).toEqual({ fullName: "Ana Reyes", bhwIdNumber: "BHW-2026-014", area: "Purok 3" });
    expect(editEmployeeSchema.safeParse({ fullName: "Ana Reyes", bhwIdNumber: "BHW-1", area: " " }).success).toBe(false);
  });

  it("only allows staff roles for staff accounts", () => {
    const base = { fullName: "Kiosk One", email: "Kiosk1@BHW.local", password: "secret123" };
    expect(staffAccountSchema.parse({ ...base, role: "kiosk" }).email).toBe("kiosk1@bhw.local");
    expect(staffAccountSchema.safeParse({ ...base, role: "employee" }).success).toBe(false);
    expect(staffAccountSchema.safeParse({ ...base, role: "viewer", password: "short" }).success).toBe(false);
  });

  it("needs a schedule and a YYYY-MM-DD effective date", () => {
    const scheduleId = "20000000-0000-4000-a000-000000000001";
    expect(scheduleAssignmentSchema.safeParse({ scheduleId, effectiveFrom: "2026-11-04" }).success).toBe(true);
    expect(scheduleAssignmentSchema.safeParse({ scheduleId: "", effectiveFrom: "2026-11-04" }).success).toBe(false);
    expect(scheduleAssignmentSchema.safeParse({ scheduleId, effectiveFrom: "11/04/2026" }).success).toBe(false);
  });
});
