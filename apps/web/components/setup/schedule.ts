import { hhmm, isoDate } from "@bhw/types";
import { z } from "zod";

// Schedule form rules mirror the `schedules` CHECK constraints (09-data-dictionary.md §5.2):
// name 2–80, work_days ⊆ 1..7 (ISO, 1 = Monday) with at least one day, end > start,
// start <= break_start < break_end <= end, grace 0–60.

export const WEEKDAYS = [
  { iso: 1, short: "Mon", long: "Monday" },
  { iso: 2, short: "Tue", long: "Tuesday" },
  { iso: 3, short: "Wed", long: "Wednesday" },
  { iso: 4, short: "Thu", long: "Thursday" },
  { iso: 5, short: "Fri", long: "Friday" },
  { iso: 6, short: "Sat", long: "Saturday" },
  { iso: 7, short: "Sun", long: "Sunday" },
] as const;

export const scheduleFormSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Name must be at least 2 characters")
      .max(80, "Name must be at most 80 characters"),
    workDays: z
      .array(z.number().int().min(1).max(7))
      .min(1, "Choose at least one work day")
      .refine((days) => new Set(days).size === days.length, "Each day can be chosen once"),
    startTime: hhmm,
    endTime: hhmm,
    breakStart: hhmm,
    breakEnd: hhmm,
    graceMinutes: z
      .number({ error: "Enter the grace period in minutes" })
      .int("Use whole minutes")
      .min(0, "Grace period cannot be negative")
      .max(60, "Grace period can be at most 60 minutes"),
  })
  .superRefine((v, ctx) => {
    if (v.endTime <= v.startTime) {
      ctx.addIssue({ code: "custom", path: ["endTime"], message: "End time must be later than start time" });
    }
    if (v.breakStart < v.startTime) {
      ctx.addIssue({ code: "custom", path: ["breakStart"], message: "Break must start at or after the start time" });
    }
    if (v.breakEnd <= v.breakStart) {
      ctx.addIssue({ code: "custom", path: ["breakEnd"], message: "Break end must be later than break start" });
    }
    if (v.breakEnd > v.endTime) {
      ctx.addIssue({ code: "custom", path: ["breakEnd"], message: "Break must end at or before the end time" });
    }
  });

export type ScheduleFormValues = z.infer<typeof scheduleFormSchema>;

export const DEFAULT_SCHEDULE: ScheduleFormValues = {
  name: "",
  workDays: [1, 2, 3, 4, 5],
  startTime: "08:00",
  endTime: "17:00",
  breakStart: "12:00",
  breakEnd: "13:00",
  graceMinutes: 15,
};

/** "08:00:00" (Postgres `time`) -> "08:00" for `<input type="time">` and display. */
export function toHhmm(time: string): string {
  return time.slice(0, 5);
}

/** Sorted unique ISO weekdays, e.g. [5, 1, 3, 1] -> [1, 3, 5]. */
export function normalizeWorkDays(days: readonly number[]): number[] {
  return [...new Set(days)].filter((d) => d >= 1 && d <= 7).sort((a, b) => a - b);
}

/** Toggles one ISO weekday in the list and keeps it sorted. */
export function toggleWorkDay(days: readonly number[], iso: number): number[] {
  return days.includes(iso) ? days.filter((d) => d !== iso) : normalizeWorkDays([...days, iso]);
}

/** Compact label: [1..5] -> "Mon–Fri", [1,3,5] -> "Mon, Wed, Fri", all -> "Every day". */
export function formatWorkDays(days: readonly number[]): string {
  const sorted = normalizeWorkDays(days);
  if (sorted.length === 0) return "No work days";
  if (sorted.length === 7) return "Every day";
  const isRun = sorted.every((d, i) => i === 0 || d === (sorted[i - 1] ?? 0) + 1);
  const short = (iso: number) => WEEKDAYS[iso - 1]?.short ?? String(iso);
  const first = sorted[0] ?? 1;
  const last = sorted[sorted.length - 1] ?? 7;
  if (isRun && sorted.length >= 3) return `${short(first)}–${short(last)}`;
  return sorted.map(short).join(", ");
}

/** Minutes between two HH:mm values (b − a). */
export function minutesBetween(a: string, b: string): number {
  const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  return toMin(b) - toMin(a);
}

/** Scheduled working minutes per day: (end − start) − break. */
export function scheduledMinutes(v: Pick<ScheduleFormValues, "startTime" | "endTime" | "breakStart" | "breakEnd">) {
  return minutesBetween(v.startTime, v.endTime) - minutesBetween(v.breakStart, v.breakEnd);
}

export interface AssignmentRange {
  employee_id: string;
  effective_from: string;
  effective_to: string | null;
}

/** Employees whose assignment to this schedule covers `today` (YYYY-MM-DD), and everyone ever assigned. */
export function countAssignments(rows: readonly AssignmentRange[], today: string): { current: number; ever: number } {
  const current = new Set<string>();
  const ever = new Set<string>();
  for (const r of rows) {
    ever.add(r.employee_id);
    if (r.effective_from <= today && (r.effective_to === null || r.effective_to >= today)) current.add(r.employee_id);
  }
  return { current: current.size, ever: ever.size };
}

/** Recompute range (recompute_attendance accepts at most 366 days, from <= to). */
export const recomputeRangeSchema = z
  .object({ from: isoDate, to: isoDate })
  .refine((v) => v.to >= v.from, { path: ["to"], message: "The end date must be on or after the start date" })
  .refine((v) => daysBetween(v.from, v.to) <= 366, {
    path: ["to"],
    message: "Recompute at most 366 days at a time",
  });
export type RecomputeRange = z.infer<typeof recomputeRangeSchema>;

/** Whole days from `a` to `b` (YYYY-MM-DD). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}
