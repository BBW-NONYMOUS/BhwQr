// Pure helpers for CSC Form No. 48. Shared by the HTML form (csc-form-48.tsx) and the PDF
// (dtr-pdf.tsx) so both print exactly what supabase/functions/generate-dtr-pdf/render.ts prints.
import { ATTENDANCE_METHODS, ATTENDANCE_STATUSES, dtrRowSchema } from "@bhw/types";
import { z } from "zod";

/** One printed line of the form (get_dtr `rows[]`, data dictionary 7.1). */
export const dtrDocumentRowSchema = dtrRowSchema.extend({
  work_date: z.string().nullable(),
  status: z.enum(ATTENDANCE_STATUSES).nullable(),
  method: z.enum(ATTENDANCE_METHODS).nullable(),
});
export type DtrDocumentRow = z.infer<typeof dtrDocumentRowSchema>;

/** The jsonb document returned by get_dtr / each element of get_dtr_batch (data dictionary 7.2). */
export const dtrDocumentSchema = z.object({
  employee: z.object({
    id: z.string(),
    full_name: z.string(),
    bhw_id_number: z.string().nullable(),
  }),
  period: z.object({ year: z.number().int(), month: z.number().int(), label: z.string() }),
  office: z.object({ name: z.string(), address: z.string() }),
  office_hours: z.object({ regular_days: z.string(), saturdays: z.string() }),
  rows: z.array(dtrDocumentRowSchema).length(31),
  totals: z.object({
    undertime_total_minutes: z.number().int(),
    undertime_hours: z.number().int(),
    undertime_minutes: z.number().int(),
    days_present: z.number().int(),
    days_absent: z.number().int(),
    days_late: z.number().int(),
    days_undertime: z.number().int(),
    days_incomplete: z.number().int(),
  }),
  certification: z.string(),
  verified_label: z.string(),
  generated_at: z.string(),
});
export type DtrDocument = z.infer<typeof dtrDocumentSchema>;

/** Parses one get_dtr result. Throws when the RPC shape changed (caught by the page). */
export function parseDtrDocument(value: unknown): DtrDocument {
  return dtrDocumentSchema.parse(value);
}

/** Parses the get_dtr_batch array. */
export function parseDtrBatch(value: unknown): DtrDocument[] {
  return z.array(dtrDocumentSchema).parse(value ?? []);
}

/** "08:05:00" -> "8:05", "13:30:00" -> "1:30" (12-hour without AM/PM, render.ts formatCell). */
export function formatCell(time: string | null): string {
  if (!time) return "";
  const [h, m] = time.split(":");
  const hour = Number(h) % 12 === 0 ? 12 : Number(h) % 12;
  return `${hour}:${m}`;
}

/**
 * Text that spans the four time cells, or null when the row prints times. Same rule as render.ts:
 * a remark is printed only on a real date with no AM and no PM arrival (Saturday, Sunday,
 * holidays, Absent, Official business without scans).
 */
export function spanningRemark(row: DtrDocumentRow): string | null {
  if (!row.work_date || !row.remark) return null;
  if (row.am_arrival || row.pm_arrival) return null;
  return row.remark.toUpperCase();
}

/** Undertime cells [hours, minutes]; blank when zero or on a non-existent day (render.ts). */
export function undertimeCells(row: DtrDocumentRow): [string, string] {
  if (!row.work_date || (!row.undertime_hours && !row.undertime_minutes)) return ["", ""];
  return [row.undertime_hours ? String(row.undertime_hours) : "", row.undertime_minutes ? String(row.undertime_minutes) : ""];
}

/** The four time cells in printed order: AM arrival, AM departure, PM arrival, PM departure. */
export function timeCells(row: DtrDocumentRow): [string, string, string, string] {
  return [
    formatCell(row.am_arrival),
    formatCell(row.am_departure),
    formatCell(row.pm_arrival),
    formatCell(row.pm_departure),
  ];
}

export interface UndertimeTotal {
  totalMinutes: number;
  hours: number;
  minutes: number;
}

/** Monthly total recomputed from the printed rows (D-23: sum of daily values). */
export function sumUndertime(rows: readonly DtrDocumentRow[]): UndertimeTotal {
  const totalMinutes = rows.reduce((acc, r) => acc + r.undertime_hours * 60 + r.undertime_minutes, 0);
  return { totalMinutes, hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 };
}

/** True when the document's TOTAL line equals the sum of its rows (AC: DTR totals match). */
export function totalsMatchRows(doc: DtrDocument): boolean {
  const sum = sumUndertime(doc.rows);
  return (
    sum.totalMinutes === doc.totals.undertime_total_minutes &&
    sum.hours === doc.totals.undertime_hours &&
    sum.minutes === doc.totals.undertime_minutes
  );
}

/** "2:21" for the summary cards. */
export function formatHoursMinutes(totalMinutes: number): string {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

export interface DtrSummary {
  employees: number;
  days_present: number;
  days_absent: number;
  days_late: number;
  days_undertime: number;
  days_incomplete: number;
  undertime_total_minutes: number;
}

/** Summary cards: the documents' own totals, added up across employees for a batch. */
export function summarizeDocuments(docs: readonly DtrDocument[]): DtrSummary {
  return docs.reduce<DtrSummary>(
    (acc, d) => ({
      employees: acc.employees + 1,
      days_present: acc.days_present + d.totals.days_present,
      days_absent: acc.days_absent + d.totals.days_absent,
      days_late: acc.days_late + d.totals.days_late,
      days_undertime: acc.days_undertime + d.totals.days_undertime,
      days_incomplete: acc.days_incomplete + d.totals.days_incomplete,
      undertime_total_minutes: acc.undertime_total_minutes + d.totals.undertime_total_minutes,
    }),
    {
      employees: 0,
      days_present: 0,
      days_absent: 0,
      days_late: 0,
      days_undertime: 0,
      days_incomplete: 0,
      undertime_total_minutes: 0,
    },
  );
}

/** "DTR-Santos-Maria-2026-10.pdf" / "DTR-batch-2026-10.pdf". */
export function dtrFileName(docs: readonly DtrDocument[], year: number, month: number): string {
  const period = `${year}-${String(month).padStart(2, "0")}`;
  if (docs.length !== 1) return `DTR-batch-${period}.pdf`;
  const name = docs[0]!.employee.full_name.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "");
  return `DTR-${name}-${period}.pdf`;
}
