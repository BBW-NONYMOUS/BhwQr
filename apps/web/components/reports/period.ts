// Period helpers shared by the DTR and report pages. All dates are Manila calendar dates
// (YYYY-MM-DD strings); nothing here converts timezones.

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

/** Earliest year the RPCs accept (get_dtr / reportFiltersSchema: 2024..2100). */
export const MIN_YEAR = 2024;
export const MAX_YEAR = 2100;

export interface YearMonth {
  year: number;
  month: number;
}

/** First string value of a search param. */
export function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Year and month of a Manila date string. */
export function yearMonthOf(isoDate: string): YearMonth {
  return { year: Number(isoDate.slice(0, 4)), month: Number(isoDate.slice(5, 7)) };
}

/** Reads ?year=&month=, falling back to the month of `today` when missing or out of range. */
export function parseYearMonth(
  year: string | undefined,
  month: string | undefined,
  today: string,
): YearMonth {
  const fallback = yearMonthOf(today);
  const y = Number(year);
  const m = Number(month);
  return {
    year: Number.isInteger(y) && y >= MIN_YEAR && y <= MAX_YEAR ? y : fallback.year,
    month: Number.isInteger(m) && m >= 1 && m <= 12 ? m : fallback.month,
  };
}

/** Years offered in the month pickers: MIN_YEAR up to the current Manila year. */
export function yearOptions(today: string): number[] {
  const current = Math.max(yearMonthOf(today).year, MIN_YEAR);
  return Array.from({ length: current - MIN_YEAR + 1 }, (_, i) => current - i);
}

export function monthLabel({ year, month }: YearMonth): string {
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

/** Adds days to a YYYY-MM-DD date without timezone drift. */
export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** True for a real calendar date in YYYY-MM-DD form. */
export function isIsoDate(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}
