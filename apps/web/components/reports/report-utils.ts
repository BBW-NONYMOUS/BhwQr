// Pure helpers for the Daily / Weekly / Monthly reports. Every total here is computed from the
// rows the page displays, never from a second query (FR-92, AC-06), so printed totals always
// match the table.
import { ATTENDANCE_STATUSES, type AttendanceMethod, type AttendanceStatus, reportFiltersSchema } from "@bhw/types";

import { mondayOf } from "@/lib/format";

import { addDays, firstParam, isIsoDate, monthLabel, parseYearMonth } from "./period";

// Row shapes from data dictionary 7.3-7.5. The generated Database types mark every column as
// non-null, but LEFT JOINed columns are NULL for employees without a record, so they are
// declared nullable here.
export interface DailyReportRow {
  employee_id: string;
  full_name: string;
  bhw_id_number: string | null;
  area: string | null;
  work_date: string;
  time_in: string | null;
  time_out: string | null;
  status: AttendanceStatus | null;
  minutes_late: number;
  undertime_minutes: number;
  method: AttendanceMethod | null;
  station_name: string | null;
}

export interface WeeklyReportRow {
  employee_id: string;
  full_name: string;
  area: string | null;
  week_start: string;
  week_end: string;
  on_time_days: number;
  late_days: number;
  undertime_days: number;
  absent_days: number;
  incomplete_days: number;
  total_minutes_late: number;
  total_undertime_minutes: number;
  daily_status: (AttendanceStatus | null)[];
}

export interface MonthlyReportRow {
  employee_id: string;
  full_name: string;
  bhw_id_number: string | null;
  area: string | null;
  scheduled_work_days: number;
  days_present: number;
  on_time_days: number;
  late_days: number;
  undertime_days: number;
  absent_days: number;
  incomplete_days: number;
  total_minutes_late: number;
  total_undertime_minutes: number;
}

export type StatusCounts = Record<AttendanceStatus, number> & { no_record: number };

function emptyCounts(): StatusCounts {
  return { on_time: 0, late: 0, absent: 0, undertime: 0, incomplete: 0, no_record: 0 };
}

export interface DailyTotals extends StatusCounts {
  employees: number;
  present: number;
  minutes_late: number;
  undertime_minutes: number;
}

/** Counts the displayed daily rows by status. `present` = rows with a time-in. */
export function dailyTotals(rows: readonly DailyReportRow[]): DailyTotals {
  const totals: DailyTotals = { ...emptyCounts(), employees: 0, present: 0, minutes_late: 0, undertime_minutes: 0 };
  for (const r of rows) {
    totals.employees += 1;
    if (r.status) totals[r.status] += 1;
    else totals.no_record += 1;
    if (r.time_in) totals.present += 1;
    totals.minutes_late += r.minutes_late ?? 0;
    totals.undertime_minutes += r.undertime_minutes ?? 0;
  }
  return totals;
}

type SummedKeys =
  | "on_time_days"
  | "late_days"
  | "undertime_days"
  | "absent_days"
  | "incomplete_days"
  | "total_minutes_late"
  | "total_undertime_minutes";

export type WeeklyTotals = Record<SummedKeys, number> & { employees: number };

/** Column sums of the displayed weekly rows. */
export function weeklyTotals(rows: readonly WeeklyReportRow[]): WeeklyTotals {
  const totals: WeeklyTotals = {
    employees: 0,
    on_time_days: 0,
    late_days: 0,
    undertime_days: 0,
    absent_days: 0,
    incomplete_days: 0,
    total_minutes_late: 0,
    total_undertime_minutes: 0,
  };
  for (const r of rows) {
    totals.employees += 1;
    totals.on_time_days += r.on_time_days;
    totals.late_days += r.late_days;
    totals.undertime_days += r.undertime_days;
    totals.absent_days += r.absent_days;
    totals.incomplete_days += r.incomplete_days;
    totals.total_minutes_late += r.total_minutes_late;
    totals.total_undertime_minutes += r.total_undertime_minutes;
  }
  return totals;
}

export type MonthlyTotals = Record<SummedKeys | "scheduled_work_days" | "days_present", number> & {
  employees: number;
};

/** Column sums of the displayed monthly rows. */
export function monthlyTotals(rows: readonly MonthlyReportRow[]): MonthlyTotals {
  const totals: MonthlyTotals = {
    employees: 0,
    scheduled_work_days: 0,
    days_present: 0,
    on_time_days: 0,
    late_days: 0,
    undertime_days: 0,
    absent_days: 0,
    incomplete_days: 0,
    total_minutes_late: 0,
    total_undertime_minutes: 0,
  };
  for (const r of rows) {
    totals.employees += 1;
    totals.scheduled_work_days += r.scheduled_work_days;
    totals.days_present += r.days_present;
    totals.on_time_days += r.on_time_days;
    totals.late_days += r.late_days;
    totals.undertime_days += r.undertime_days;
    totals.absent_days += r.absent_days;
    totals.incomplete_days += r.incomplete_days;
    totals.total_minutes_late += r.total_minutes_late;
    totals.total_undertime_minutes += r.total_undertime_minutes;
  }
  return totals;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export interface WeekdayCounts extends StatusCounts {
  date: string;
  /** "Mon 5" */
  label: string;
}

/**
 * Per-day counts for the weekly stacked bar chart (FR-96): for each position 0..6 (Monday..Sunday)
 * of `daily_status`, count the statuses across the displayed rows. NULL counts as "no record".
 */
export function weeklyPerDay(rows: readonly WeeklyReportRow[], weekStart: string): WeekdayCounts[] {
  return WEEKDAYS.map((day, i) => {
    const date = addDays(weekStart, i);
    const counts = emptyCounts();
    for (const r of rows) {
      const status = r.daily_status[i] ?? null;
      if (status) counts[status] += 1;
      else counts.no_record += 1;
    }
    return { ...counts, date, label: `${day} ${Number(date.slice(8, 10))}` };
  });
}

// ---------------------------------------------------------------------------
// Search params
// ---------------------------------------------------------------------------

export const REPORT_TABS = ["daily", "weekly", "monthly"] as const;
export type ReportTab = (typeof REPORT_TABS)[number];

export interface ReportParams {
  tab: ReportTab;
  /** Daily date (YYYY-MM-DD). */
  date: string;
  /** Monday of the weekly report. */
  weekStart: string;
  year: number;
  month: number;
  area: string | null;
  status: AttendanceStatus | null;
}

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * Reads ?tab=&date=&week=&year=&month=&area=&status= with Manila-today defaults, validated with
 * the shared reportFiltersSchema. Invalid values fall back to the defaults instead of erroring.
 */
export function parseReportParams(sp: SearchParams, today: string): ReportParams {
  const tabParam = firstParam(sp.tab);
  const tab: ReportTab = (REPORT_TABS as readonly string[]).includes(tabParam ?? "") ? (tabParam as ReportTab) : "daily";
  const rawDate = firstParam(sp.date);
  const rawWeek = firstParam(sp.week);
  const area = firstParam(sp.area)?.trim() || null;
  const rawStatus = firstParam(sp.status);
  const status = (ATTENDANCE_STATUSES as readonly string[]).includes(rawStatus ?? "")
    ? (rawStatus as AttendanceStatus)
    : null;
  const { year, month } = parseYearMonth(firstParam(sp.year), firstParam(sp.month), today);

  const date = isIsoDate(rawDate) ? rawDate : today;
  const weekStart = mondayOf(isIsoDate(rawWeek) ? rawWeek : today);

  const check = reportFiltersSchema.safeParse(
    tab === "daily"
      ? { period: "daily", date, area: area ?? undefined }
      : tab === "weekly"
        ? { period: "weekly", weekStart, area: area ?? undefined }
        : { period: "monthly", year, month, area: area ?? undefined },
  );
  if (!check.success) {
    return { tab, date: today, weekStart: mondayOf(today), year, month, area: null, status: null };
  }
  return { tab, date, weekStart, year, month, area, status };
}

/** Query string for a report URL; omits empty values. */
export function reportQuery(p: Partial<Record<keyof ReportParams, string | number | null>>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) {
    if (v === null || v === undefined || v === "") continue;
    q.set(k === "weekStart" ? "week" : k, String(v));
  }
  return q.toString();
}

const longDate = new Intl.DateTimeFormat("en-PH", {
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});
const shortDate = new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", timeZone: "UTC" });
const shortDateYear = new Intl.DateTimeFormat("en-PH", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

function asUtcNoon(date: string): Date {
  return new Date(`${date}T12:00:00Z`);
}

/** Title and period line printed under the barangay header. */
export function reportHeading(p: ReportParams): { title: string; period: string } {
  if (p.tab === "daily") return { title: "Daily Attendance Report", period: longDate.format(asUtcNoon(p.date)) };
  if (p.tab === "weekly") {
    const end = addDays(p.weekStart, 6);
    return {
      title: "Weekly Attendance Report",
      period: `${shortDate.format(asUtcNoon(p.weekStart))} – ${shortDateYear.format(asUtcNoon(end))} (Monday–Sunday)`,
    };
  }
  return { title: "Monthly Attendance Report", period: monthLabel({ year: p.year, month: p.month }) };
}

/** File name stem for CSV export, e.g. "daily-report-2026-11-01". */
export function reportFileStem(p: ReportParams): string {
  const area = p.area ? `-${p.area.replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase()}` : "";
  if (p.tab === "daily") return `daily-report-${p.date}${area}`;
  if (p.tab === "weekly") return `weekly-report-${p.weekStart}${area}`;
  return `monthly-report-${p.year}-${String(p.month).padStart(2, "0")}${area}`;
}
