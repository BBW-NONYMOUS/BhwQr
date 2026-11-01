import { isoDate } from "@bhw/types";
import { z } from "zod";

export interface HolidayEntry {
  date: string;
  name: string;
}

/**
 * Philippine regular holidays for 2026 (RA 9492 and the 2026 proclamation; Holy Week falls on
 * Apr 2–3 because Easter Sunday is Apr 5, 2026). Special non-working days are added by hand.
 */
export const PH_REGULAR_HOLIDAYS: Readonly<Record<number, readonly HolidayEntry[]>> = {
  2026: [
    { date: "2026-01-01", name: "New Year's Day" },
    { date: "2026-04-02", name: "Maundy Thursday" },
    { date: "2026-04-03", name: "Good Friday" },
    { date: "2026-04-09", name: "Araw ng Kagitingan" },
    { date: "2026-05-01", name: "Labor Day" },
    { date: "2026-06-12", name: "Independence Day" },
    { date: "2026-08-31", name: "National Heroes Day" },
    { date: "2026-11-30", name: "Bonifacio Day" },
    { date: "2026-12-25", name: "Christmas Day" },
    { date: "2026-12-30", name: "Rizal Day" },
  ],
};

/** Preset entries whose date is not yet in the holidays table (dates are the primary key). */
export function missingHolidays(existingDates: Iterable<string>, preset: readonly HolidayEntry[]): HolidayEntry[] {
  const have = new Set(existingDates);
  return preset.filter((h) => !have.has(h.date));
}

/** Years offered in the year Select: a window around the current year plus any year with data. */
export function holidayYearOptions(currentYear: number, extra: Iterable<number> = []): number[] {
  const years = new Set<number>([currentYear - 1, currentYear, currentYear + 1]);
  for (const y of Object.keys(PH_REGULAR_HOLIDAYS)) years.add(Number(y));
  for (const y of extra) if (Number.isInteger(y) && y >= 2024 && y <= 2100) years.add(y);
  return [...years].sort((a, b) => a - b);
}

/** Reads ?year= safely; falls back to the current year. */
export function parseYear(value: string | string[] | undefined, currentYear: number): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 2024 && n <= 2100 ? n : currentYear;
}

// Mirrors holidays CHECKs: date is the PK; name non-blank, at most 100 (DDL) — the dictionary
// minimum of 2 characters is enforced here too.
export const holidayFormSchema = z.object({
  date: isoDate,
  name: z
    .string()
    .trim()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be at most 100 characters"),
});
export type HolidayFormValues = z.infer<typeof holidayFormSchema>;
