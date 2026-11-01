jest.mock("@/lib/supabase", () => ({ getSupabase: jest.fn() }));

import { addDays, isoWeekday, manilaHour, manilaToday, weekRange } from "@/lib/queries/home";

describe("Manila date helpers (Home)", () => {
  it("uses the Manila date, not the phone's UTC date", () => {
    // 17:30 UTC on Nov 1 is 01:30 on Nov 2 in Manila (UTC+8).
    expect(manilaToday(new Date("2026-11-01T17:30:00Z"))).toBe("2026-11-02");
    expect(manilaToday(new Date("2026-11-01T15:59:00Z"))).toBe("2026-11-01");
    expect(manilaHour(new Date("2026-11-01T17:30:00Z"))).toBe(1);
    expect(manilaHour(new Date("2026-11-01T00:00:00Z"))).toBe(8);
  });

  it("computes ISO weekdays like schedules.work_days (1 = Monday … 7 = Sunday)", () => {
    expect(isoWeekday("2026-11-02")).toBe(1);
    expect(isoWeekday("2026-11-01")).toBe(7);
  });

  it("finds the Monday–Sunday week, also across a month boundary", () => {
    expect(weekRange("2026-11-01")).toEqual({ start: "2026-10-26", end: "2026-11-01" });
    expect(weekRange("2026-11-04")).toEqual({ start: "2026-11-02", end: "2026-11-08" });
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});
