import { describe, expect, it } from "vitest";

import { monthLabel, parseYearMonth, yearOptions } from "./period";
import {
  type DailyReportRow,
  type MonthlyReportRow,
  type WeeklyReportRow,
  dailyTotals,
  monthlyTotals,
  parseReportParams,
  reportFileStem,
  reportHeading,
  reportQuery,
  weeklyPerDay,
  weeklyTotals,
} from "./report-utils";

function daily(partial: Partial<DailyReportRow>): DailyReportRow {
  return {
    employee_id: crypto.randomUUID(),
    full_name: "Test",
    bhw_id_number: null,
    area: "Purok Malipayon",
    work_date: "2026-10-05",
    time_in: null,
    time_out: null,
    status: null,
    minutes_late: 0,
    undertime_minutes: 0,
    method: null,
    station_name: null,
    ...partial,
  };
}

function weekly(daily_status: WeeklyReportRow["daily_status"], partial: Partial<WeeklyReportRow> = {}): WeeklyReportRow {
  const count = (s: string) => daily_status.filter((d) => d === s).length;
  return {
    employee_id: crypto.randomUUID(),
    full_name: "Test",
    area: null,
    week_start: "2026-10-05",
    week_end: "2026-10-11",
    on_time_days: count("on_time"),
    late_days: count("late"),
    undertime_days: count("undertime"),
    absent_days: count("absent"),
    incomplete_days: count("incomplete"),
    total_minutes_late: 0,
    total_undertime_minutes: 0,
    daily_status,
    ...partial,
  };
}

describe("dailyTotals", () => {
  it("counts the displayed rows by status, NULL as no record", () => {
    const rows = [
      daily({ status: "on_time", time_in: "2026-10-05T00:01:00Z" }),
      daily({ status: "late", time_in: "2026-10-05T00:21:00Z", minutes_late: 21 }),
      daily({ status: "late", time_in: "2026-10-05T00:05:00Z", minutes_late: 5 }),
      daily({ status: "incomplete", time_in: "2026-10-05T00:00:00Z" }),
      daily({ status: "undertime", time_in: "2026-10-05T00:00:00Z", undertime_minutes: 30 }),
      daily({ status: "absent" }),
      daily({}),
    ];
    const t = dailyTotals(rows);
    expect(t).toMatchObject({
      employees: 7,
      present: 5,
      on_time: 1,
      late: 2,
      incomplete: 1,
      undertime: 1,
      absent: 1,
      no_record: 1,
      minutes_late: 26,
      undertime_minutes: 30,
    });
    // Every row lands in exactly one bucket, so the buckets add up to the row count (AC-06).
    expect(t.on_time + t.late + t.undertime + t.incomplete + t.absent + t.no_record).toBe(rows.length);
  });

  it("is all zeros for no rows", () => {
    expect(dailyTotals([])).toMatchObject({ employees: 0, present: 0, no_record: 0 });
  });
});

describe("weekly", () => {
  const rows = [
    weekly(["on_time", "late", "on_time", "absent", "on_time", null, null], { total_minutes_late: 12 }),
    weekly(["late", "late", "incomplete", "on_time", "undertime", null, null], { total_minutes_late: 40, total_undertime_minutes: 15 }),
    weekly(["absent", null, null, null, null, null, null]),
  ];

  it("counts each position of daily_status for the stacked chart", () => {
    const days = weeklyPerDay(rows, "2026-10-05");
    expect(days.map((d) => d.label)).toEqual(["Mon 5", "Tue 6", "Wed 7", "Thu 8", "Fri 9", "Sat 10", "Sun 11"]);
    expect(days[0]).toMatchObject({ date: "2026-10-05", on_time: 1, late: 1, absent: 1, no_record: 0 });
    expect(days[1]).toMatchObject({ late: 2, no_record: 1 });
    expect(days[2]).toMatchObject({ on_time: 1, incomplete: 1, no_record: 1 });
    expect(days[3]).toMatchObject({ absent: 1, on_time: 1, no_record: 1 });
    expect(days[4]).toMatchObject({ on_time: 1, undertime: 1, no_record: 1 });
    expect(days[6]).toMatchObject({ no_record: 3, on_time: 0 });
    for (const d of days) {
      expect(d.on_time + d.late + d.undertime + d.incomplete + d.absent + d.no_record).toBe(rows.length);
    }
  });

  it("per-day counts agree with the per-employee day columns", () => {
    const days = weeklyPerDay(rows, "2026-10-05");
    const t = weeklyTotals(rows);
    const sum = (k: "on_time" | "late" | "absent" | "incomplete" | "undertime") => days.reduce((a, d) => a + d[k], 0);
    expect(sum("on_time")).toBe(t.on_time_days);
    expect(sum("late")).toBe(t.late_days);
    expect(sum("absent")).toBe(t.absent_days);
    expect(sum("incomplete")).toBe(t.incomplete_days);
    expect(sum("undertime")).toBe(t.undertime_days);
    expect(t).toMatchObject({ employees: 3, total_minutes_late: 52, total_undertime_minutes: 15 });
  });
});

describe("monthlyTotals", () => {
  it("sums the displayed rows", () => {
    const base: MonthlyReportRow = {
      employee_id: "a",
      full_name: "A",
      bhw_id_number: null,
      area: null,
      scheduled_work_days: 21,
      days_present: 20,
      on_time_days: 16,
      late_days: 3,
      undertime_days: 1,
      absent_days: 1,
      incomplete_days: 0,
      total_minutes_late: 47,
      total_undertime_minutes: 30,
    };
    const t = monthlyTotals([base, { ...base, employee_id: "b", late_days: 0, absent_days: 2, days_present: 19 }]);
    expect(t).toMatchObject({ employees: 2, scheduled_work_days: 42, days_present: 39, late_days: 3, absent_days: 3, total_minutes_late: 94 });
  });
});

describe("parseReportParams", () => {
  const today = "2026-11-01";

  it("defaults to today's daily report", () => {
    expect(parseReportParams({}, today)).toEqual({
      tab: "daily",
      date: today,
      weekStart: "2026-10-26",
      year: 2026,
      month: 11,
      area: null,
      status: null,
    });
  });

  it("normalises the week to its Monday and ignores invalid values", () => {
    const p = parseReportParams({ tab: "weekly", week: "2026-10-08", status: "bogus", date: "2026-02-30" }, today);
    expect(p).toMatchObject({ tab: "weekly", weekStart: "2026-10-05", status: null, date: today });
  });

  it("reads month, area and status", () => {
    const p = parseReportParams({ tab: "monthly", year: "2026", month: "10", area: "Purok Masagana", status: "late" }, today);
    expect(p).toMatchObject({ tab: "monthly", year: 2026, month: 10, area: "Purok Masagana", status: "late" });
    expect(reportHeading(p)).toEqual({ title: "Monthly Attendance Report", period: "October 2026" });
    expect(reportFileStem(p)).toBe("monthly-report-2026-10-purok-masagana");
  });

  it("builds query strings without empty values", () => {
    expect(reportQuery({ tab: "weekly", weekStart: "2026-10-05", area: null })).toBe("tab=weekly&week=2026-10-05");
  });
});

describe("period helpers", () => {
  it("falls back to the current month for out-of-range values", () => {
    expect(parseYearMonth("1999", "13", "2026-11-01")).toEqual({ year: 2026, month: 11 });
    expect(parseYearMonth("2025", "2", "2026-11-01")).toEqual({ year: 2025, month: 2 });
    expect(yearOptions("2026-11-01")).toEqual([2026, 2025, 2024]);
    expect(monthLabel({ year: 2026, month: 10 })).toBe("October 2026");
  });
});
