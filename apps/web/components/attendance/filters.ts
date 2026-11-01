import {
  ATTENDANCE_METHODS,
  ATTENDANCE_STATUSES,
  CORRECTION_STATUSES,
  CORRECTION_TYPES,
  type AttendanceMethod,
  type AttendanceStatus,
  type CorrectionStatus,
  type CorrectionType,
} from "@bhw/types";

// Pure helpers for the Attendance Records filters (searchParams <-> query). Shared by the
// Server Component (parse) and the client filter bar (serialize), and unit tested.

export const DEFAULT_RANGE_DAYS = 7;
/** Hard cap on rows fetched for one page view; the page tells the admin when it is reached. */
export const ATTENDANCE_ROW_LIMIT = 1000;
/** Longest range accepted from the URL, so a typo cannot ask for years of rows. */
export const MAX_RANGE_DAYS = 366;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface AttendanceFilters {
  from: string;
  to: string;
  employeeId: string | null;
  status: AttendanceStatus | null;
  method: AttendanceMethod | null;
}

export type RawSearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** True for a real calendar date in YYYY-MM-DD form (rejects 2026-02-30). */
export function isIsoDate(value: string | undefined): value is string {
  if (!value || !ISO_DATE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/** Adds whole days to a YYYY-MM-DD date without timezone drift. */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Inclusive number of days between two YYYY-MM-DD dates. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / 86_400_000) + 1;
}

/** Last 7 days ending today (Manila date supplied by the caller). */
export function defaultRange(today: string): { from: string; to: string } {
  return { from: addDays(today, -(DEFAULT_RANGE_DAYS - 1)), to: today };
}

/**
 * Reads the filters from the URL. Anything invalid falls back to the default instead of
 * failing the page: bad dates → last 7 days, unknown status/method → all, non-uuid employee → all.
 */
export function parseAttendanceFilters(params: RawSearchParams, today: string): AttendanceFilters {
  const fallback = defaultRange(today);
  let from = first(params.from);
  let to = first(params.to);
  if (!isIsoDate(from)) from = undefined;
  if (!isIsoDate(to)) to = undefined;

  if (from && !to) to = from > today ? from : today;
  if (to && !from) from = addDays(to, -(DEFAULT_RANGE_DAYS - 1));
  if (!from || !to) ({ from, to } = fallback);
  if (from > to) [from, to] = [to, from];
  if (daysBetween(from, to) > MAX_RANGE_DAYS) from = addDays(to, -(MAX_RANGE_DAYS - 1));

  const employee = first(params.employee);
  const status = first(params.status);
  const method = first(params.method);

  return {
    from,
    to,
    employeeId: employee && UUID.test(employee) ? employee.toLowerCase() : null,
    status: (ATTENDANCE_STATUSES as readonly string[]).includes(status ?? "") ? (status as AttendanceStatus) : null,
    method: (ATTENDANCE_METHODS as readonly string[]).includes(method ?? "") ? (method as AttendanceMethod) : null,
  };
}

/** Serializes filters for router.push; omits values equal to "all". */
export function attendanceFiltersToSearch(filters: AttendanceFilters): string {
  const sp = new URLSearchParams();
  sp.set("from", filters.from);
  sp.set("to", filters.to);
  if (filters.employeeId) sp.set("employee", filters.employeeId);
  if (filters.status) sp.set("status", filters.status);
  if (filters.method) sp.set("method", filters.method);
  return sp.toString();
}

/** Equality filters to apply after the date range, in a stable order (column, value). */
export function attendanceEqFilters(filters: AttendanceFilters): [column: "employee_id" | "status" | "method", value: string][] {
  const out: [column: "employee_id" | "status" | "method", value: string][] = [];
  if (filters.employeeId) out.push(["employee_id", filters.employeeId]);
  if (filters.status) out.push(["status", filters.status]);
  if (filters.method) out.push(["method", filters.method]);
  return out;
}

const hhmmFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Manila",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/**
 * Manila wall-clock "HH:mm" of a timestamp, for prefilling the time inputs of the manual entry
 * dialog. The server converts the edited HH:mm back to a timestamp (manila_ts in SQL).
 */
export function toManilaHHmm(ts: string | null | undefined): string | null {
  if (!ts) return null;
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return null;
  return hhmmFmt.format(d);
}

// ---------------------------------------------------------------------------
// Correction Requests (FR-73): tab = status, plus type and employee filters.
// ---------------------------------------------------------------------------

export interface CorrectionFilters {
  status: CorrectionStatus;
  type: CorrectionType | null;
  employeeId: string | null;
}

export function parseCorrectionFilters(params: RawSearchParams): CorrectionFilters {
  const status = first(params.status);
  const type = first(params.type);
  const employee = first(params.employee);
  return {
    status: (CORRECTION_STATUSES as readonly string[]).includes(status ?? "")
      ? (status as CorrectionStatus)
      : "pending",
    type: (CORRECTION_TYPES as readonly string[]).includes(type ?? "") ? (type as CorrectionType) : null,
    employeeId: employee && UUID.test(employee) ? employee.toLowerCase() : null,
  };
}

export function correctionFiltersToSearch(filters: CorrectionFilters): string {
  const sp = new URLSearchParams();
  if (filters.status !== "pending") sp.set("status", filters.status);
  if (filters.type) sp.set("type", filters.type);
  if (filters.employeeId) sp.set("employee", filters.employeeId);
  return sp.toString();
}
