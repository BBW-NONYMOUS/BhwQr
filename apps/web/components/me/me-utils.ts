// Pure helpers for the employee /me page (unit tested in me-utils.test.tsx).

const MONTHS = [
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

/** First day of the month and the given Manila date (YYYY-MM-DD) for "this month so far". */
export function monthToDate(today: string): { from: string; to: string } {
  return { from: `${today.slice(0, 7)}-01`, to: today };
}

export interface MonthOption {
  /** "2026-11" */
  value: string;
  /** "November 2026" */
  label: string;
  year: number;
  month: number;
}

/** The current Manila month and the `count - 1` months before it, newest first. */
export function recentMonths(today: string, count = 6): MonthOption[] {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  return Array.from({ length: count }, (_, i) => {
    const index = year * 12 + (month - 1) - i;
    const y = Math.floor(index / 12);
    const m = (index % 12) + 1;
    return {
      value: `${y}-${String(m).padStart(2, "0")}`,
      label: `${MONTHS[m - 1]} ${y}`,
      year: y,
      month: m,
    };
  });
}

/** Number of unread notifications. */
export function unreadCount(items: readonly { read_at: string | null }[]): number {
  return items.reduce((n, item) => (item.read_at ? n : n + 1), 0);
}
