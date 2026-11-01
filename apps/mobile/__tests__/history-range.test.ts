import {
  addDays,
  formatManilaTime,
  isValidIsoDate,
  manilaNowHhmm,
  manilaToday,
  shiftMonth,
  startOfWeek,
} from "@/components/history/dates";
import { historyRange } from "@/components/history/range";

describe("Manila date helpers", () => {
  it("uses the Manila calendar date, not UTC", () => {
    // 2026-10-31 17:00 UTC is already 2026-11-01 01:00 in Manila.
    expect(manilaToday(new Date("2026-10-31T17:00:00Z"))).toBe("2026-11-01");
    expect(manilaToday(new Date("2026-10-31T15:59:00Z"))).toBe("2026-10-31");
    expect(manilaNowHhmm(new Date("2026-10-31T17:05:00Z"))).toBe("01:05");
  });

  it("formats timestamps as Manila HH:mm", () => {
    expect(formatManilaTime("2026-10-23T00:30:14+00:00")).toBe("08:30");
    expect(formatManilaTime("2026-10-23T09:07:14+00:00")).toBe("17:07");
    expect(formatManilaTime(null)).toBe("—");
  });

  it("validates real calendar dates", () => {
    expect(isValidIsoDate("2026-02-28")).toBe(true);
    expect(isValidIsoDate("2026-02-30")).toBe(false);
    expect(isValidIsoDate("2026-2-3")).toBe(false);
  });

  it("does date arithmetic across month and year ends", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(shiftMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
    expect(shiftMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
  });

  it("starts weeks on Monday", () => {
    expect(startOfWeek("2026-11-01")).toBe("2026-10-26"); // Sunday → previous Monday
    expect(startOfWeek("2026-11-02")).toBe("2026-11-02"); // Monday
    expect(startOfWeek("2026-11-07")).toBe("2026-11-02"); // Saturday
  });
});

describe("historyRange (History segments)", () => {
  it("this week = Monday → today", () => {
    expect(historyRange("this_week", "2026-11-05")).toEqual({ from: "2026-11-02", to: "2026-11-05" });
  });

  it("this month = 1st → today", () => {
    expect(historyRange("this_month", "2026-11-05")).toEqual({ from: "2026-11-01", to: "2026-11-05" });
  });

  it("last month = the whole previous month", () => {
    expect(historyRange("last_month", "2026-11-05")).toEqual({ from: "2026-10-01", to: "2026-10-31" });
    expect(historyRange("last_month", "2026-03-15")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(historyRange("last_month", "2028-03-01")).toEqual({ from: "2028-02-01", to: "2028-02-29" });
    expect(historyRange("last_month", "2027-01-10")).toEqual({ from: "2026-12-01", to: "2026-12-31" });
  });
});
