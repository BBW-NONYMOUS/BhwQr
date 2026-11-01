import { APP_TIMEZONE, type AttendanceMethod, type AttendanceStatus, type Database } from "@bhw/types";

// Pure, framework-free helpers shared by the admin and viewer dashboards. Everything here is
// unit-tested in dashboard-data.test.tsx; components only render what these return.

type Rpc = Database["public"]["Functions"];

export type DashboardToday = Rpc["get_dashboard_today"]["Returns"][number];
export type TrendRow = Rpc["get_attendance_trend"]["Returns"][number];

/**
 * get_daily_summary LEFT JOINs attendance_records, so every record column is null for an employee
 * who has not scanned yet. The generated types do not express that; this type does.
 */
export interface DailyRow {
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

export function toDailyRows(rows: Rpc["get_daily_summary"]["Returns"] | null | undefined): DailyRow[] {
  return (rows ?? []).map((r) => ({
    employee_id: r.employee_id,
    full_name: r.full_name,
    bhw_id_number: r.bhw_id_number ?? null,
    area: r.area ?? null,
    work_date: r.work_date,
    time_in: r.time_in ?? null,
    time_out: r.time_out ?? null,
    status: r.status ?? null,
    minutes_late: r.minutes_late ?? 0,
    undertime_minutes: r.undertime_minutes ?? 0,
    method: r.method ?? null,
    station_name: r.station_name ?? null,
  }));
}

// ---------------------------------------------------------------------------------------------
// Weekly trend chart
// ---------------------------------------------------------------------------------------------

/** Stacking order of the weekly chart, bottom to top. Colors come from --chart-* tokens. */
export const TREND_SERIES = ["on_time", "late", "undertime", "incomplete", "absent"] as const;
export type TrendSeries = (typeof TREND_SERIES)[number];

export interface TrendPoint extends Record<TrendSeries, number> {
  /** YYYY-MM-DD (Manila work date). */
  date: string;
  /** Short axis label, e.g. "Mon 26". */
  label: string;
  /** Long label for tooltips and the screen-reader table, e.g. "Monday, Oct 26". */
  fullLabel: string;
  total: number;
}

const weekdayShort = new Intl.DateTimeFormat("en-PH", { timeZone: APP_TIMEZONE, weekday: "short" });
const dayOfMonth = new Intl.DateTimeFormat("en-PH", { timeZone: APP_TIMEZONE, day: "numeric" });
const longDay = new Intl.DateTimeFormat("en-PH", {
  timeZone: APP_TIMEZONE,
  weekday: "long",
  month: "short",
  day: "numeric",
});

/** Noon in Manila on a YYYY-MM-DD date, so formatting never shifts the day. */
function manilaNoon(date: string): Date {
  return new Date(`${date}T12:00:00+08:00`);
}

/** Maps get_attendance_trend rows to chart points, oldest day first. */
export function toTrendChartData(rows: readonly TrendRow[] | null | undefined): TrendPoint[] {
  return [...(rows ?? [])]
    .sort((a, b) => a.work_date.localeCompare(b.work_date))
    .map((row) => {
      const d = manilaNoon(row.work_date);
      const counts = {
        on_time: row.on_time ?? 0,
        late: row.late ?? 0,
        undertime: row.undertime ?? 0,
        incomplete: row.incomplete ?? 0,
        absent: row.absent ?? 0,
      };
      return {
        date: row.work_date,
        label: `${weekdayShort.format(d)} ${dayOfMonth.format(d)}`,
        fullLabel: longDay.format(d),
        ...counts,
        total: TREND_SERIES.reduce((sum, key) => sum + counts[key], 0),
      };
    });
}

/** True when the period has no attendance records at all (show the empty state instead). */
export function isTrendEmpty(points: readonly TrendPoint[]): boolean {
  return points.every((p) => p.total === 0);
}

// ---------------------------------------------------------------------------------------------
// Live scans
// ---------------------------------------------------------------------------------------------

export type ScanAction = "time_in" | "time_out";

export interface ScanRecordRef {
  time_in_scan_id: string | null;
  time_out_scan_id: string | null;
}

/**
 * Whether a successful scan wrote a time-in or a time-out: the attendance record of that day
 * points at the scan through time_in_scan_id / time_out_scan_id. Null when no record references
 * it (e.g. the record was later replaced by an approved correction).
 */
export function deriveScanAction(scanId: string, records: readonly ScanRecordRef[]): ScanAction | null {
  for (const r of records) {
    if (r.time_out_scan_id === scanId) return "time_out";
    if (r.time_in_scan_id === scanId) return "time_in";
  }
  return null;
}

export interface RawLiveScan {
  id: string;
  created_at: string;
  employee: { full_name: string; bhw_id_number: string | null } | null;
  station: { name: string } | null;
}

export interface LiveScan {
  id: string;
  createdAt: string;
  employeeName: string;
  bhwIdNumber: string | null;
  stationName: string | null;
  action: ScanAction | null;
}

/** Joins scan rows with the day's records into list items, newest first. */
export function toLiveScans(scans: readonly RawLiveScan[], records: readonly ScanRecordRef[]): LiveScan[] {
  return [...scans]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map((s) => ({
      id: s.id,
      createdAt: s.created_at,
      employeeName: s.employee?.full_name ?? "Unknown employee",
      bhwIdNumber: s.employee?.bhw_id_number ?? null,
      stationName: s.station?.name ?? null,
      action: deriveScanAction(s.id, records),
    }));
}

export const SCAN_ACTION_LABELS: Record<ScanAction, string> = {
  time_in: "Time in",
  time_out: "Time out",
};

// ---------------------------------------------------------------------------------------------
// Stat cards
// ---------------------------------------------------------------------------------------------

/** Whole-number percentage of `part` in `total`; 0 when total is 0. */
export function percentOf(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

/** Start of a Manila work date as an ISO timestamp with offset, for created_at filters. */
export function manilaDayStart(date: string): string {
  return `${date}T00:00:00+08:00`;
}

/** Names the live list needs to show a Realtime change before the server refresh arrives. */
export interface LiveDirectory {
  employees: Record<string, { name: string; bhwIdNumber: string | null }>;
  stations: Record<string, string>;
}

/** The attendance_records columns a Realtime change carries that the live list uses. */
export interface RealtimeAttendanceRow {
  employee_id: string;
  station_id: string | null;
  time_in: string | null;
  time_out: string | null;
  time_in_scan_id: string | null;
  time_out_scan_id: string | null;
}

/** Browser event the dashboard's Realtime bridge dispatches for every attendance change. */
export const ATTENDANCE_CHANGE_EVENT = "bhw:attendance-change";

/**
 * Turns a Realtime attendance change into a live-list item immediately (AC-05). Returns null for
 * changes not caused by a scan (manual entry, corrections, the end-of-day job have no scan id).
 */
export function liveScanFromRecord(row: RealtimeAttendanceRow, directory: LiveDirectory): LiveScan | null {
  const isOut = row.time_out !== null && row.time_out_scan_id !== null;
  const scanId = isOut ? row.time_out_scan_id : row.time_in_scan_id;
  const createdAt = isOut ? row.time_out : row.time_in;
  if (!scanId || !createdAt) return null;
  const employee = directory.employees[row.employee_id];
  return {
    id: scanId,
    createdAt,
    employeeName: employee?.name ?? "Employee",
    bhwIdNumber: employee?.bhwIdNumber ?? null,
    stationName: row.station_id ? (directory.stations[row.station_id] ?? null) : null,
    action: isOut ? "time_out" : "time_in",
  };
}

/** Server items win; realtime items not yet on the server list go first; newest first, capped. */
export function mergeLiveScans(serverScans: readonly LiveScan[], pending: readonly LiveScan[], limit = 20): LiveScan[] {
  const known = new Set(serverScans.map((s) => s.id));
  return [...pending.filter((p) => !known.has(p.id)), ...serverScans]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}
