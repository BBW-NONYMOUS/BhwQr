import { endOfMonth, startOfMonth, startOfPreviousMonth, startOfWeek } from "./dates";

/** History filter segments (Paper SegmentedButtons). */
export const HISTORY_SEGMENTS = ["this_week", "this_month", "last_month"] as const;
export type HistorySegment = (typeof HISTORY_SEGMENTS)[number];

export const HISTORY_SEGMENT_LABELS: Record<HistorySegment, { en: string; fil: string }> = {
  this_week: { en: "This week", fil: "Ngayong linggo" },
  this_month: { en: "This month", fil: "Ngayong buwan" },
  last_month: { en: "Last month", fil: "Nakaraang buwan" },
};

export interface DateRange {
  from: string;
  to: string;
}

/**
 * Inclusive Manila date range for a history segment, given today's Manila date:
 *  - this_week:  Monday of this week → today
 *  - this_month: 1st of this month → today
 *  - last_month: 1st → last day of the previous month
 */
export function historyRange(segment: HistorySegment, today: string): DateRange {
  switch (segment) {
    case "this_week":
      return { from: startOfWeek(today), to: today };
    case "this_month":
      return { from: startOfMonth(today), to: today };
    case "last_month": {
      const from = startOfPreviousMonth(today);
      return { from, to: endOfMonth(from) };
    }
  }
}
