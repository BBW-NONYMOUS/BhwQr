import { APP_TIMEZONE } from "@bhw/types";

import type { Lang } from "@/lib/messages";

/**
 * Asia/Manila calendar helpers (BR-01). Work dates are plain "YYYY-MM-DD" strings; arithmetic is
 * done on UTC dates so the phone's own timezone can never shift a day.
 */

const isoDateFmt = new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIMEZONE });
const timeFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: APP_TIMEZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Today's Manila date as YYYY-MM-DD. */
export function manilaToday(now: Date = new Date()): string {
  return isoDateFmt.format(now);
}

/** Current Manila wall-clock time as HH:mm. */
export function manilaNowHhmm(now: Date = new Date()): string {
  return timeFmt.format(now);
}

/** "08:05" (Manila) for a timestamp, or "—" when there is none. */
export function formatManilaTime(ts: string | null | undefined): string {
  return ts ? timeFmt.format(new Date(ts)) : "—";
}

function toUtc(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d));
}

function fromUtc(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** True for a real calendar date in YYYY-MM-DD form (rejects 2026-02-30). */
export function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE_RE.test(value)) return false;
  return fromUtc(toUtc(value)) === value;
}

export function addDays(iso: string, days: number): string {
  const d = toUtc(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUtc(d);
}

/** 0 = Sunday … 6 = Saturday. */
export function dayOfWeek(iso: string): number {
  return toUtc(iso).getUTCDay();
}

/** Monday of the week containing `iso` (Philippine work weeks start on Monday). */
export function startOfWeek(iso: string): string {
  return addDays(iso, -((dayOfWeek(iso) + 6) % 7));
}

export function startOfMonth(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function endOfMonth(iso: string): string {
  const [y, m] = iso.split("-").map(Number) as [number, number];
  return `${iso.slice(0, 7)}-${String(daysInMonth(y, m)).padStart(2, "0")}`;
}

/** First day of the month before the one containing `iso`. */
export function startOfPreviousMonth(iso: string): string {
  return startOfMonth(addDays(startOfMonth(iso), -1));
}

export interface YearMonth {
  year: number;
  month: number;
}

export function yearMonthOf(iso: string): YearMonth {
  const [year, month] = iso.split("-").map(Number) as [number, number];
  return { year, month };
}

export function shiftMonth({ year, month }: YearMonth, delta: number): YearMonth {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export function compareYearMonth(a: YearMonth, b: YearMonth): number {
  return a.year * 12 + a.month - (b.year * 12 + b.month);
}

function locale(lang: Lang): string {
  return lang === "fil" ? "fil-PH" : "en-PH";
}

/** "Mon, Nov 2, 2026" (English) / Filipino equivalent for a work date. */
export function formatWorkDate(iso: string, lang: Lang, withYear = true): string {
  return new Intl.DateTimeFormat(locale(lang), {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(withYear ? { year: "numeric" as const } : {}),
  }).format(toUtc(iso));
}

/** "November 2026" in the chosen language. */
export function formatMonthLabel({ year, month }: YearMonth, lang: Lang): string {
  return new Intl.DateTimeFormat(locale(lang), { timeZone: "UTC", month: "long", year: "numeric" }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  );
}

/** "Nov 2, 2026, 08:05" (Manila) for a timestamp. */
export function formatManilaDateTime(ts: string | number, lang: Lang): string {
  return new Intl.DateTimeFormat(locale(lang), {
    timeZone: APP_TIMEZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(ts));
}

/** 135 -> "2 h 15 min", 0 -> "0 min". */
export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
