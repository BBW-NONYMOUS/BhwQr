import type { AttendanceMethod, AttendanceStatus } from "@bhw/types";

import type { Lang } from "@/lib/messages";

/** One CSC Form No. 48 line from `get_dtr().rows` (09-data-dictionary.md §7.1). */
export interface DtrRowData {
  day: number;
  work_date: string | null;
  am_arrival: string | null;
  am_departure: string | null;
  pm_arrival: string | null;
  pm_departure: string | null;
  undertime_hours: number | null;
  undertime_minutes: number | null;
  remark: string | null;
  status: AttendanceStatus | null;
  method: AttendanceMethod | null;
}

export interface DtrTotals {
  undertime_total_minutes: number;
  undertime_hours: number;
  undertime_minutes: number;
  days_present: number;
  days_absent: number;
  days_late: number;
  days_undertime: number;
  days_incomplete: number;
}

/**
 * How a DTR line is drawn:
 *  - "blank":  the day does not exist in this month (e.g. Feb 30) – everything empty
 *  - "remark": no time cells – the remark ("Saturday", "Absent", holiday) spans the 4 time columns
 *  - "times":  at least one time cell; a remark, if any, is shown as a note under the times
 */
export type DtrDisplayRow = {
  day: number;
  kind: "blank" | "remark" | "times";
  cells: [string, string, string, string];
  utHours: string;
  utMinutes: string;
  remark: string | null;
  /** Weekend / holiday / non-working-day lines are drawn muted. */
  muted: boolean;
  status: AttendanceStatus | null;
};

/** "08:21:00" → "08:21"; null → "". */
export function formatDtrTime(value: string | null): string {
  if (!value) return "";
  const m = /^(\d{2}):(\d{2})/.exec(value);
  return m ? `${m[1]}:${m[2]}` : value;
}

const REMARKS_FIL: Record<string, string> = {
  Saturday: "Sabado",
  Sunday: "Linggo",
  Absent: "Liban",
  "No time-out": "Walang time-out",
  "Official business": "Opisyal na lakad",
  "Non-working day": "Hindi araw ng trabaho",
  "No schedule assigned": "Walang nakatakdang schedule",
};

const MUTED_REMARKS = new Set(["Saturday", "Sunday", "Non-working day"]);

/** Server remarks are English; known ones are translated, holiday names are kept as written. */
export function translateRemark(remark: string, lang: Lang): string {
  return lang === "fil" ? (REMARKS_FIL[remark] ?? remark) : remark;
}

export function toDtrDisplayRow(row: DtrRowData, lang: Lang): DtrDisplayRow {
  if (!row.work_date) {
    return { day: row.day, kind: "blank", cells: ["", "", "", ""], utHours: "", utMinutes: "", remark: null, muted: true, status: null };
  }
  const cells: [string, string, string, string] = [
    formatDtrTime(row.am_arrival),
    formatDtrTime(row.am_departure),
    formatDtrTime(row.pm_arrival),
    formatDtrTime(row.pm_departure),
  ];
  const hasTimes = cells.some((c) => c !== "");
  const h = row.undertime_hours ?? 0;
  const m = row.undertime_minutes ?? 0;
  const hasUndertime = h > 0 || m > 0;
  const remark = row.remark ? translateRemark(row.remark, lang) : null;
  const isHoliday = row.remark !== null && row.status === null && !MUTED_REMARKS.has(row.remark);
  return {
    day: row.day,
    kind: !hasTimes && remark ? "remark" : "times",
    cells,
    utHours: hasUndertime ? String(h) : "",
    utMinutes: hasUndertime ? String(m) : "",
    remark,
    muted: (row.remark !== null && MUTED_REMARKS.has(row.remark)) || isHoliday,
    status: row.status,
  };
}

export interface DtrTotalItem {
  key: keyof Omit<DtrTotals, "undertime_total_minutes" | "undertime_hours" | "undertime_minutes">;
  label: string;
  value: number;
}

const TOTAL_LABELS: Record<DtrTotalItem["key"], { en: string; fil: string }> = {
  days_present: { en: "Present", fil: "Pumasok" },
  days_absent: { en: "Absent", fil: "Liban" },
  days_late: { en: "Late", fil: "Huli" },
  days_undertime: { en: "Undertime", fil: "Kulang sa oras" },
  days_incomplete: { en: "No time-out", fil: "Walang time-out" },
};

export function dtrTotalItems(totals: DtrTotals, lang: Lang): DtrTotalItem[] {
  return (Object.keys(TOTAL_LABELS) as DtrTotalItem["key"][]).map((key) => ({
    key,
    label: TOTAL_LABELS[key][lang],
    value: totals[key],
  }));
}

/** File name for the downloaded PDF, e.g. "DTR-BHW-KII-2019-001-2026-10.pdf". */
export function dtrFileName(bhwId: string | null | undefined, year: number, month: number): string {
  const id = (bhwId ?? "employee").replace(/[^\w-]+/g, "_");
  return `DTR-${id}-${year}-${String(month).padStart(2, "0")}.pdf`;
}
