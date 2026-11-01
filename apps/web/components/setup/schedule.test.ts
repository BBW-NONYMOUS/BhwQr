import { describe, expect, it } from "vitest";

import {
  DEFAULT_SCHEDULE,
  countAssignments,
  formatWorkDays,
  recomputeRangeSchema,
  scheduleFormSchema,
  scheduledMinutes,
  toHhmm,
  toggleWorkDay,
} from "./schedule";

const valid = { ...DEFAULT_SCHEDULE, name: "Regular Mon–Fri 8–5" };

function errorPaths(input: unknown): string[] {
  const r = scheduleFormSchema.safeParse(input);
  return r.success ? [] : r.error.issues.map((i) => i.path.join("."));
}

describe("scheduleFormSchema (mirrors schedules CHECKs)", () => {
  it("accepts the seeded Mon–Fri 08:00–17:00 schedule", () => {
    expect(scheduleFormSchema.safeParse(valid).success).toBe(true);
  });

  it("requires end time after start time", () => {
    expect(errorPaths({ ...valid, startTime: "17:00", endTime: "08:00", breakStart: "17:00", breakEnd: "17:30" })).toContain(
      "endTime",
    );
  });

  it("keeps the break inside work hours", () => {
    expect(errorPaths({ ...valid, breakStart: "07:30" })).toContain("breakStart");
    expect(errorPaths({ ...valid, breakEnd: "17:30" })).toContain("breakEnd");
    expect(errorPaths({ ...valid, breakStart: "13:00", breakEnd: "12:00" })).toContain("breakEnd");
  });

  it("allows a break that touches start or end", () => {
    expect(scheduleFormSchema.safeParse({ ...valid, breakStart: "08:00", breakEnd: "09:00" }).success).toBe(true);
    expect(scheduleFormSchema.safeParse({ ...valid, breakStart: "16:00", breakEnd: "17:00" }).success).toBe(true);
  });

  it("limits grace to 0–60 whole minutes", () => {
    expect(errorPaths({ ...valid, graceMinutes: 61 })).toContain("graceMinutes");
    expect(errorPaths({ ...valid, graceMinutes: -1 })).toContain("graceMinutes");
    expect(errorPaths({ ...valid, graceMinutes: 2.5 })).toContain("graceMinutes");
    expect(errorPaths({ ...valid, graceMinutes: Number.NaN })).toContain("graceMinutes");
    expect(scheduleFormSchema.safeParse({ ...valid, graceMinutes: 0 }).success).toBe(true);
  });

  it("needs 1–7 distinct ISO weekdays and a 2–80 character name", () => {
    expect(errorPaths({ ...valid, workDays: [] })).toContain("workDays");
    expect(errorPaths({ ...valid, workDays: [0] })).toContain("workDays.0");
    expect(errorPaths({ ...valid, workDays: [1, 1] })).toContain("workDays");
    expect(errorPaths({ ...valid, name: " A " })).toContain("name");
    expect(errorPaths({ ...valid, name: "x".repeat(81) })).toContain("name");
  });

  it("rejects malformed times", () => {
    expect(errorPaths({ ...valid, startTime: "8:00" })).toContain("startTime");
  });
});

describe("work day helpers", () => {
  it("formats runs and lists", () => {
    expect(formatWorkDays([1, 2, 3, 4, 5])).toBe("Mon–Fri");
    expect(formatWorkDays([5, 1, 3])).toBe("Mon, Wed, Fri");
    expect(formatWorkDays([1, 2])).toBe("Mon, Tue");
    expect(formatWorkDays([1, 2, 3, 4, 5, 6, 7])).toBe("Every day");
    expect(formatWorkDays([])).toBe("No work days");
  });

  it("toggles a day and keeps the list sorted", () => {
    expect(toggleWorkDay([1, 2, 3], 2)).toEqual([1, 3]);
    expect(toggleWorkDay([3, 1], 2)).toEqual([1, 2, 3]);
  });
});

describe("time helpers", () => {
  it("trims seconds from Postgres time values", () => {
    expect(toHhmm("08:00:00")).toBe("08:00");
    expect(toHhmm("17:30")).toBe("17:30");
  });

  it("computes scheduled minutes minus the break", () => {
    expect(scheduledMinutes(DEFAULT_SCHEDULE)).toBe(480);
  });
});

describe("countAssignments", () => {
  const rows = [
    { employee_id: "a", effective_from: "2026-01-01", effective_to: null },
    { employee_id: "b", effective_from: "2026-01-01", effective_to: "2026-06-30" },
    { employee_id: "c", effective_from: "2026-12-01", effective_to: null },
    { employee_id: "a", effective_from: "2025-01-01", effective_to: "2025-12-31" },
  ];

  it("counts employees covered today and everyone ever assigned", () => {
    expect(countAssignments(rows, "2026-11-01")).toEqual({ current: 1, ever: 3 });
    expect(countAssignments(rows, "2026-06-30")).toEqual({ current: 2, ever: 3 });
  });
});

describe("recomputeRangeSchema", () => {
  it("accepts up to 366 days in order", () => {
    expect(recomputeRangeSchema.safeParse({ from: "2026-01-01", to: "2027-01-02" }).success).toBe(true);
    expect(recomputeRangeSchema.safeParse({ from: "2026-01-01", to: "2027-01-03" }).success).toBe(false);
    expect(recomputeRangeSchema.safeParse({ from: "2026-02-01", to: "2026-01-31" }).success).toBe(false);
  });
});
