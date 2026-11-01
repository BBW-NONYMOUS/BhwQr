import { describe, expect, it } from "vitest";

import { monthToDate, recentMonths, unreadCount } from "./me-utils";

describe("monthToDate", () => {
  it("runs from the first of the month to today", () => {
    expect(monthToDate("2026-11-09")).toEqual({ from: "2026-11-01", to: "2026-11-09" });
    expect(monthToDate("2026-01-01")).toEqual({ from: "2026-01-01", to: "2026-01-01" });
  });
});

describe("recentMonths", () => {
  it("lists the current month first and crosses the year boundary", () => {
    const months = recentMonths("2026-02-15", 4);
    expect(months.map((m) => m.value)).toEqual(["2026-02", "2026-01", "2025-12", "2025-11"]);
    expect(months[0]).toMatchObject({ label: "February 2026", year: 2026, month: 2 });
    expect(months[2]).toMatchObject({ label: "December 2025", year: 2025, month: 12 });
  });

  it("defaults to six months", () => {
    expect(recentMonths("2026-11-01")).toHaveLength(6);
  });
});

describe("unreadCount", () => {
  it("counts items without read_at", () => {
    expect(unreadCount([{ read_at: null }, { read_at: "2026-11-01T00:00:00Z" }, { read_at: null }])).toBe(2);
    expect(unreadCount([])).toBe(0);
  });
});
