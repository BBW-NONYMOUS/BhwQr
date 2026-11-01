import { APP_TIMEZONE } from "@bhw/types";

// Display helpers. Every time shown in the portal is Asia/Manila (BR-01); the server already
// computed status and minutes, so these only format.

const timeFmt = new Intl.DateTimeFormat("en-PH", {
  timeZone: APP_TIMEZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const dateFmt = new Intl.DateTimeFormat("en-PH", {
  timeZone: APP_TIMEZONE,
  year: "numeric",
  month: "short",
  day: "numeric",
});
const dateTimeFmt = new Intl.DateTimeFormat("en-PH", {
  timeZone: APP_TIMEZONE,
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const isoDateFmt = new Intl.DateTimeFormat("en-CA", { timeZone: APP_TIMEZONE });

/** "08:05" in Manila time, or "—" for null. */
export function formatTime(ts: string | null | undefined): string {
  return ts ? timeFmt.format(new Date(ts)) : "—";
}

/** "Nov 9, 2026" for a timestamp or a YYYY-MM-DD date (dates are not shifted). */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00+08:00`) : new Date(value);
  return dateFmt.format(d);
}

export function formatDateTime(ts: string | null | undefined): string {
  return ts ? dateTimeFmt.format(new Date(ts)) : "—";
}

/** Today's Manila date as YYYY-MM-DD. */
export function manilaToday(now = new Date()): string {
  return isoDateFmt.format(now);
}

/** 135 -> "2 h 15 min", 0 -> "0 min". */
export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** Monday (YYYY-MM-DD) of the Manila week containing `date`. */
export function mondayOf(date: string): string {
  const d = new Date(`${date}T12:00:00+08:00`);
  const dow = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}
