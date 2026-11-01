import { describe, expect, it } from "vitest";

import { PH_REGULAR_HOLIDAYS, holidayFormSchema, holidayYearOptions, missingHolidays, parseYear } from "./holidays";

const preset2026 = PH_REGULAR_HOLIDAYS[2026] ?? [];

describe("PH_REGULAR_HOLIDAYS 2026", () => {
  it("has the ten regular holidays on valid, unique 2026 dates", () => {
    expect(preset2026).toHaveLength(10);
    const dates = preset2026.map((h) => h.date);
    expect(new Set(dates).size).toBe(10);
    for (const d of dates) {
      expect(d.startsWith("2026-")).toBe(true);
      expect(holidayFormSchema.safeParse(preset2026.find((h) => h.date === d)).success).toBe(true);
    }
  });

  it("places Holy Week before Easter Sunday (Apr 5, 2026)", () => {
    expect(preset2026.find((h) => h.name === "Maundy Thursday")?.date).toBe("2026-04-02");
    expect(preset2026.find((h) => h.name === "Good Friday")?.date).toBe("2026-04-03");
    expect(new Date("2026-04-03T12:00:00+08:00").getUTCDay()).toBe(5);
  });
});

describe("missingHolidays (quick-add diff)", () => {
  it("returns every preset entry when none exist", () => {
    expect(missingHolidays([], preset2026)).toHaveLength(10);
  });

  it("skips dates already present, even with another name", () => {
    const missing = missingHolidays(["2026-01-01", "2026-12-25", "2026-03-15"], preset2026);
    expect(missing).toHaveLength(8);
    expect(missing.map((h) => h.date)).not.toContain("2026-01-01");
    expect(missing.map((h) => h.date)).not.toContain("2026-12-25");
  });

  it("returns nothing when all exist", () => {
    expect(missingHolidays(preset2026.map((h) => h.date), preset2026)).toEqual([]);
  });
});

describe("year helpers", () => {
  it("offers a window around the current year plus preset and data years, sorted", () => {
    expect(holidayYearOptions(2027, [2024])).toEqual([2024, 2026, 2027, 2028]);
  });

  it("parses ?year= or falls back", () => {
    expect(parseYear("2025", 2026)).toBe(2025);
    expect(parseYear(["2027"], 2026)).toBe(2027);
    expect(parseYear("abc", 2026)).toBe(2026);
    expect(parseYear("1999", 2026)).toBe(2026);
    expect(parseYear(undefined, 2026)).toBe(2026);
  });
});

describe("holidayFormSchema", () => {
  it("validates date and name length", () => {
    expect(holidayFormSchema.safeParse({ date: "2026-08-21", name: "Ninoy Aquino Day" }).success).toBe(true);
    expect(holidayFormSchema.safeParse({ date: "2026-8-21", name: "Ninoy Aquino Day" }).success).toBe(false);
    expect(holidayFormSchema.safeParse({ date: "2026-08-21", name: " x " }).success).toBe(false);
    expect(holidayFormSchema.safeParse({ date: "2026-08-21", name: "x".repeat(101) }).success).toBe(false);
  });
});
