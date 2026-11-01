import { APP_TIMEZONE, ATTENDANCE_STATUSES, type AttendanceStatus } from "@bhw/types";

// Pure helpers for the kiosk screen (core flow 3). No React and no browser APIs, so they are unit
// tested in kiosk-utils.test.tsx.

/**
 * Offset between server time and this device's clock, captured when a server response arrives.
 * The kiosk never shows the device clock (BR-01, core flow 8): server time = Date.now() + offset.
 */
export function serverClockOffset(serverNowMs: number, receivedAtDeviceMs: number): number {
  return serverNowMs - receivedAtDeviceMs;
}

/** Current server time estimated from the stored offset. */
export function serverTimeFrom(offsetMs: number, deviceNowMs: number): number {
  return deviceNowMs + offsetMs;
}

/**
 * Remaining share of the refresh interval as 0–100 for the countdown bar.
 * `nextRefreshAt` and `now` are on the same (device) timeline; only the difference matters.
 */
export function countdownPercent(nextRefreshAt: number, refreshMs: number, now: number): number {
  if (refreshMs <= 0) return 0;
  const remaining = nextRefreshAt - now;
  const pct = (remaining / refreshMs) * 100;
  return Math.min(100, Math.max(0, pct));
}

/** Whole seconds left until the next refresh, never negative. */
export function countdownSeconds(nextRefreshAt: number, now: number): number {
  return Math.max(0, Math.ceil((nextRefreshAt - now) / 1000));
}

const FIL_WEEKDAYS: Record<string, string> = {
  Monday: "Lunes",
  Tuesday: "Martes",
  Wednesday: "Miyerkules",
  Thursday: "Huwebes",
  Friday: "Biyernes",
  Saturday: "Sabado",
  Sunday: "Linggo",
};

const weekdayFmt = new Intl.DateTimeFormat("en-US", { timeZone: APP_TIMEZONE, weekday: "long" });
const dateFmt = new Intl.DateTimeFormat("en-PH", {
  timeZone: APP_TIMEZONE,
  year: "numeric",
  month: "long",
  day: "numeric",
});
const timeFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: APP_TIMEZONE,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

export interface ManilaClock {
  weekday: string;
  weekdayFil: string;
  date: string;
  /** HH:mm:ss, 24-hour */
  time: string;
}

/** Splits a server timestamp into the parts the kiosk clock shows, in Asia/Manila time. */
export function manilaClockParts(serverNowMs: number): ManilaClock {
  const d = new Date(serverNowMs);
  const weekday = weekdayFmt.format(d);
  return {
    weekday,
    weekdayFil: FIL_WEEKDAYS[weekday] ?? weekday,
    date: dateFmt.format(d),
    time: timeFmt.format(d),
  };
}

export const FEED_ACTION_LABELS = {
  time_in: { en: "Time-in", fil: "Pumasok" },
  time_out: { en: "Time-out", fil: "Umuwi" },
} as const;
export type FeedAction = keyof typeof FEED_ACTION_LABELS;

export interface KioskFeedRow {
  first_name: string;
  action: string;
  at_time: string;
  status: string;
}

export interface KioskFeedItem {
  key: string;
  firstName: string;
  action: FeedAction;
  actionLabel: string;
  actionLabelFil: string;
  /** HH:mm Manila time, already formatted by get_kiosk_feed */
  time: string;
  status: AttendanceStatus | null;
}

function isAttendanceStatus(value: string): value is AttendanceStatus {
  return (ATTENDANCE_STATUSES as readonly string[]).includes(value);
}

/**
 * Maps get_kiosk_feed rows (newest first) to display items with stable keys, so only new scans
 * animate in when the list is polled again.
 */
export function toFeedItems(rows: readonly KioskFeedRow[], limit = 10): KioskFeedItem[] {
  const seen = new Map<string, number>();
  return rows.slice(0, limit).map((row) => {
    const action: FeedAction = row.action === "time_out" ? "time_out" : "time_in";
    const firstName = row.first_name.trim() || "—";
    const base = `${row.at_time}|${firstName}|${action}`;
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    return {
      key: n === 0 ? base : `${base}|${n}`,
      firstName,
      action,
      actionLabel: FEED_ACTION_LABELS[action].en,
      actionLabelFil: FEED_ACTION_LABELS[action].fil,
      time: row.at_time,
      status: isAttendanceStatus(row.status) ? row.status : null,
    };
  });
}

/** "+1.3 s" / "-12.0 s" for the drift badge. */
export function formatDrift(driftMs: number): string {
  const s = driftMs / 1000;
  const sign = s > 0 ? "+" : s < 0 ? "−" : "";
  return `${sign}${Math.abs(s).toFixed(1)} s`;
}

/**
 * supabase-js reports a failed fetch (no connection) as a PostgREST error without an SQL state
 * code; real database errors always carry one.
 */
export function isNetworkDbError(error: { code?: string | null } | null): boolean {
  return error !== null && !error.code;
}

/** Catalog code from an Edge Function error body ({ ok:false, code, message }), if present. */
export function errorCodeFromBody(body: unknown): string | null {
  if (body && typeof body === "object" && "code" in body && typeof body.code === "string") {
    return body.code;
  }
  return null;
}

/** Delay before retrying a failed token request: 3 s, 6 s, 12 s, capped at 15 s. */
export function retryDelayMs(failureCount: number): number {
  const n = Math.max(1, failureCount);
  return Math.min(15_000, 3_000 * 2 ** (n - 1));
}
