import { ERROR_SEVERITIES, ERROR_SOURCES, type ErrorSeverity, type ErrorSource } from "@bhw/types";

// URL filters for Error Logs and Audit Log. Dates are Manila calendar dates (YYYY-MM-DD).

export type SearchParams = Record<string, string | string[] | undefined>;

/** Newest rows loaded per page; older rows need a narrower date range. */
export const LOG_ROW_LIMIT = 1000;
/** Default range when the URL has none: the last 7 Manila days including today. */
export const DEFAULT_RANGE_DAYS = 7;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function validDate(v: string | undefined): string | undefined {
  return v && ISO_DATE.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) ? v : undefined;
}

/** Adds whole days to a YYYY-MM-DD date. */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Inclusive Manila date range -> [gte, lt) UTC instants for timestamptz filters. */
export function manilaRangeBounds(from: string, to: string): { gte: string; lt: string } {
  return {
    gte: new Date(`${from}T00:00:00+08:00`).toISOString(),
    lt: new Date(`${addDays(to, 1)}T00:00:00+08:00`).toISOString(),
  };
}

export interface DateRange {
  from: string;
  to: string;
}

/** Reads ?from=&to=, defaulting to the last 7 days; swaps them when reversed. */
export function parseDateRange(sp: SearchParams, today: string): DateRange {
  let from = validDate(first(sp.from)) ?? addDays(today, -(DEFAULT_RANGE_DAYS - 1));
  let to = validDate(first(sp.to)) ?? today;
  if (from > to) [from, to] = [to, from];
  return { from, to };
}

export interface ErrorLogFilters extends DateRange {
  source: ErrorSource | null;
  severity: ErrorSeverity | null;
}

export function parseErrorLogFilters(sp: SearchParams, today: string): ErrorLogFilters {
  const source = first(sp.source);
  const severity = first(sp.severity);
  return {
    ...parseDateRange(sp, today),
    source: (ERROR_SOURCES as readonly string[]).includes(source ?? "") ? (source as ErrorSource) : null,
    severity: (ERROR_SEVERITIES as readonly string[]).includes(severity ?? "") ? (severity as ErrorSeverity) : null,
  };
}

/** Tables with the audit trigger, plus tables touched by named admin actions. */
export const AUDITED_TABLES = [
  "app_settings",
  "attendance_records",
  "correction_requests",
  "devices",
  "employee_schedules",
  "holidays",
  "profiles",
  "schedules",
  "stations",
] as const;

export interface AuditLogFilters extends DateRange {
  table: string | null;
  /** A profile id, "system" (actor_id IS NULL), or null for everyone. */
  actor: string | null;
}

export function parseAuditLogFilters(sp: SearchParams, today: string): AuditLogFilters {
  const table = first(sp.table);
  const actor = first(sp.actor);
  return {
    ...parseDateRange(sp, today),
    table: table && /^[a-z_]{1,63}$/.test(table) ? table : null,
    actor: actor === "system" || (actor && UUID.test(actor)) ? actor : null,
  };
}

export const SEVERITY_LABELS: Record<ErrorSeverity, string> = {
  info: "Info",
  warning: "Warning",
  error: "Error",
  critical: "Critical",
};

export const SOURCE_LABELS: Record<ErrorSource, string> = {
  edge_function: "Edge Function",
  kiosk: "Kiosk",
  mobile: "Mobile app",
  web: "Web portal",
};

/** Humanises a table name: "attendance_records" -> "Attendance records". */
export function tableLabel(name: string): string {
  const s = name.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Humanises an audit action: "approve_employee" -> "Approve employee". */
export function actionLabel(action: string): string {
  return tableLabel(action);
}
