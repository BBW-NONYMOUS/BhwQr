import { CORRECTION_TYPES, type CorrectionType } from "@bhw/types";

import { isValidIsoDate, startOfMonth, startOfPreviousMonth } from "@/components/history/dates";
import type { Lang } from "@/lib/messages";

/** Default `app_settings.correction_window_days` (D-26) used until the setting is loaded. */
export const DEFAULT_CORRECTION_WINDOW_DAYS = 5;

export type DateEligibility =
  | { ok: true }
  | { ok: false; reason: "invalid" | "future" | "too_old" };

/**
 * Client-side copy of `public.correction_date_eligible` (D-26, BR-64): the work date must not be
 * in the future and must be in the current month, or in the previous month while today's day of
 * the month is <= correction_window_days. The server checks again (CORRECTION_NOT_ELIGIBLE).
 */
export function checkCorrectionDate(workDate: string, today: string, windowDays: number): DateEligibility {
  if (!isValidIsoDate(workDate)) return { ok: false, reason: "invalid" };
  if (workDate > today) return { ok: false, reason: "future" };
  const month = startOfMonth(workDate);
  if (month === startOfMonth(today)) return { ok: true };
  const todayDay = Number(today.slice(8, 10));
  if (month === startOfPreviousMonth(today) && todayDay <= windowDays) return { ok: true };
  return { ok: false, reason: "too_old" };
}

/** The rule shown under the date field. */
export function correctionRuleText(windowDays: number, lang: Lang): string {
  return lang === "fil"
    ? `Maaaring humiling para sa mga araw ngayong buwan, o sa nakaraang buwan hanggang ika-${windowDays} ng buwang ito. Hindi puwede ang petsa sa hinaharap.`
    : `You can request a correction for any day this month, or for last month until day ${windowDays} of this month. Future dates are not allowed.`;
}

export function dateEligibilityMessage(reason: "invalid" | "future" | "too_old", windowDays: number, lang: Lang): string {
  const messages = {
    invalid: {
      en: "Enter a valid date as YYYY-MM-DD, for example 2026-11-02.",
      fil: "Maglagay ng tamang petsa (YYYY-MM-DD), halimbawa 2026-11-02.",
    },
    future: {
      en: "You cannot request a correction for a future date.",
      fil: "Hindi puwedeng humiling ng pagtatama para sa petsa sa hinaharap.",
    },
    too_old: {
      en: `This date is too old. Only this month, or last month until day ${windowDays}, can be corrected.`,
      fil: `Lampas na ang petsang ito. Ngayong buwan lamang, o ang nakaraang buwan hanggang ika-${windowDays}, ang puwedeng itama.`,
    },
  } as const;
  return messages[reason][lang];
}

/** Which time fields the form shows for each correction type. */
export function timeFieldsFor(type: CorrectionType | null): { timeIn: boolean; timeOut: boolean } {
  switch (type) {
    case "missing_time_in":
      return { timeIn: true, timeOut: false };
    case "missing_time_out":
      return { timeIn: false, timeOut: true };
    case "wrong_time":
    case "official_business":
      return { timeIn: true, timeOut: true };
    default:
      return { timeIn: false, timeOut: false };
  }
}

export function isCorrectionType(value: unknown): value is CorrectionType {
  return typeof value === "string" && (CORRECTION_TYPES as readonly string[]).includes(value);
}

/**
 * Normalises what a user types into a time box to 24-hour HH:mm:
 * "8:05" → "08:05", "0805" → "08:05", "805" → "08:05", "17:3" stays invalid.
 * Returns the trimmed input unchanged when it cannot be read as a time.
 */
export function normalizeHhmm(input: string): string {
  const v = input.trim().replace(/[.\s]/g, ":");
  let h: string | undefined;
  let m: string | undefined;
  const colon = /^(\d{1,2}):(\d{2})$/.exec(v);
  const digits = /^(\d{3,4})$/.exec(v);
  if (colon) {
    h = colon[1];
    m = colon[2];
  } else if (digits) {
    h = v.slice(0, v.length - 2);
    m = v.slice(-2);
  }
  if (h === undefined || m === undefined) return input.trim();
  const hh = Number(h);
  const mm = Number(m);
  if (hh > 23 || mm > 59) return input.trim();
  return `${String(hh).padStart(2, "0")}:${m}`;
}

/** True when `hhmm` on `workDate` is later than now (Manila). Server code: FUTURE_TIME_NOT_ALLOWED. */
export function isFutureTime(workDate: string, hhmm: string, today: string, nowHhmm: string): boolean {
  if (workDate > today) return true;
  return workDate === today && hhmm > nowHhmm;
}
