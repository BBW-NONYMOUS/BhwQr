import type { Lang, Tables } from "@bhw/types";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

import { getSupabase } from "@/lib/supabase";

/**
 * Home screen data (TanStack Query). Every query goes through getSupabase(), so RLS returns only
 * the signed-in employee's own rows; the explicit employee_id filters keep the queries index-friendly.
 * All keys start with HOME_QUERY_KEY so a successful scan can refresh the whole screen at once.
 */
export const HOME_QUERY_KEY = ["home"] as const;

export const MANILA_TZ = "Asia/Manila";

// ---------------------------------------------------------------------------------------------
// Manila date helpers (Intl with timeZone "Asia/Manila"; attendance work dates are Manila dates).
// ---------------------------------------------------------------------------------------------

function localeFor(lang: Lang): string {
  return lang === "fil" ? "fil-PH" : "en-PH";
}

function manilaParts(d: Date): Record<"year" | "month" | "day" | "hour", string> {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: MANILA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "00";
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour") };
}

/** Today's Manila work date as YYYY-MM-DD. */
export function manilaToday(now: Date = new Date()): string {
  const p = manilaParts(now);
  return `${p.year}-${p.month}-${p.day}`;
}

/** Current hour (0-23) in Manila, for the greeting. */
export function manilaHour(now: Date = new Date()): number {
  return Number(manilaParts(now).hour) % 24;
}

/** ISO weekday of a YYYY-MM-DD date: 1 = Monday … 7 = Sunday (same as schedules.work_days). */
export function isoWeekday(date: string): number {
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
  return dow === 0 ? 7 : dow;
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Monday and Sunday of the Manila week that contains `date`. */
export function weekRange(date: string): { start: string; end: string } {
  const start = addDays(date, 1 - isoWeekday(date));
  return { start, end: addDays(start, 6) };
}

/** "8:01 AM" for a timestamptz, shown in Manila time. */
export function formatManilaTime(iso: string | null | undefined, lang: Lang): string {
  if (!iso) return "--:--";
  return new Intl.DateTimeFormat(localeFor(lang), { timeZone: MANILA_TZ, hour: "numeric", minute: "2-digit" }).format(
    new Date(iso),
  );
}

/** "8:00 AM" for a schedule time-of-day ("08:00:00") on a Manila date. */
export function formatScheduleTime(time: string, date: string, lang: Lang): string {
  return formatManilaTime(`${date}T${time.slice(0, 8)}+08:00`, lang);
}

/** "Sunday, November 1, 2026" for the Home header. */
export function formatManilaLongDate(date: string, lang: Lang): string {
  return new Intl.DateTimeFormat(localeFor(lang), {
    timeZone: MANILA_TZ,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${date}T12:00:00+08:00`));
}

/** "Mon, Oct 26" for list rows. */
export function formatManilaShortDate(date: string, lang: Lang): string {
  return new Intl.DateTimeFormat(localeFor(lang), {
    timeZone: MANILA_TZ,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(`${date}T12:00:00+08:00`));
}

// ---------------------------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------------------------

export type HomeRecord = Pick<
  Tables<"attendance_records">,
  "id" | "work_date" | "time_in" | "time_out" | "status" | "minutes_late" | "undertime_minutes"
>;

export type HomeSchedule = Pick<Tables<"schedules">, "name" | "start_time" | "end_time" | "grace_minutes" | "work_days">;

const RECORD_COLUMNS = "id, work_date, time_in, time_out, status, minutes_late, undertime_minutes";

export function useTodayRecord(userId: string | undefined, today: string) {
  return useQuery({
    queryKey: [...HOME_QUERY_KEY, "today", userId, today],
    enabled: Boolean(userId),
    queryFn: async (): Promise<HomeRecord | null> => {
      const { data, error } = await getSupabase()
        .from("attendance_records")
        .select(RECORD_COLUMNS)
        .eq("employee_id", userId ?? "")
        .eq("work_date", today)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

/** The schedule in effect today (employee_schedules → schedules), or null when none is assigned. */
export function useCurrentSchedule(userId: string | undefined, today: string) {
  return useQuery({
    queryKey: [...HOME_QUERY_KEY, "schedule", userId, today],
    enabled: Boolean(userId),
    queryFn: async (): Promise<HomeSchedule | null> => {
      const { data, error } = await getSupabase()
        .from("employee_schedules")
        .select("effective_from, schedules(name, start_time, end_time, grace_minutes, work_days)")
        .eq("employee_id", userId ?? "")
        .lte("effective_from", today)
        .or(`effective_to.is.null,effective_to.gte.${today}`)
        .order("effective_from", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data?.schedules ?? null;
    },
  });
}

interface WeekRaw {
  presentDates: string[];
  holidays: string[];
}

/**
 * This Week progress: days with a time-in / scheduled work days (Mon–Sun, minus holidays).
 * `workDays` comes from the current schedule; null while it is loading.
 */
export function useWeekProgress(userId: string | undefined, today: string, workDays: number[] | null | undefined) {
  const { start, end } = weekRange(today);
  const query = useQuery({
    queryKey: [...HOME_QUERY_KEY, "week", userId, start],
    enabled: Boolean(userId),
    queryFn: async (): Promise<WeekRaw> => {
      const supabase = getSupabase();
      const [records, holidays] = await Promise.all([
        supabase
          .from("attendance_records")
          .select("work_date, time_in")
          .eq("employee_id", userId ?? "")
          .gte("work_date", start)
          .lte("work_date", end),
        supabase.from("holidays").select("date").gte("date", start).lte("date", end),
      ]);
      if (records.error) throw records.error;
      if (holidays.error) throw holidays.error;
      return {
        presentDates: records.data.filter((r) => r.time_in !== null).map((r) => r.work_date),
        holidays: holidays.data.map((h) => h.date),
      };
    },
  });

  const summary = useMemo(() => {
    if (!query.data) return null;
    const holidaySet = new Set(query.data.holidays);
    let scheduled = 0;
    for (let i = 0; i < 7; i++) {
      const day = addDays(start, i);
      if ((workDays ?? []).includes(isoWeekday(day)) && !holidaySet.has(day)) scheduled++;
    }
    const present = new Set(query.data.presentDates).size;
    const percent = scheduled > 0 ? Math.min(100, Math.round((present / scheduled) * 100)) : 0;
    return { present, scheduled, percent };
  }, [query.data, workDays, start]);

  return { ...query, summary };
}

export function useRecentRecords(userId: string | undefined) {
  return useQuery({
    queryKey: [...HOME_QUERY_KEY, "recent", userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<HomeRecord[]> => {
      const { data, error } = await getSupabase()
        .from("attendance_records")
        .select(RECORD_COLUMNS)
        .eq("employee_id", userId ?? "")
        .order("work_date", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
  });
}

export function useUnreadNotifications(userId: string | undefined) {
  return useQuery({
    queryKey: [...HOME_QUERY_KEY, "unread", userId],
    enabled: Boolean(userId),
    queryFn: async (): Promise<number> => {
      const { count, error } = await getSupabase()
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId ?? "")
        .is("read_at", null);
      if (error) throw error;
      return count ?? 0;
    },
  });
}

/** app_settings.max_gps_accuracy_m for the pre-scan health check (default 50 m). */
export const DEFAULT_MAX_GPS_ACCURACY_M = 50;

export function useMaxGpsAccuracy() {
  return useQuery({
    queryKey: ["app_settings", "max_gps_accuracy_m"],
    queryFn: async (): Promise<number> => {
      const { data, error } = await getSupabase()
        .from("app_settings")
        .select("max_gps_accuracy_m")
        .eq("id", 1)
        .maybeSingle();
      if (error) throw error;
      return data?.max_gps_accuracy_m ?? DEFAULT_MAX_GPS_ACCURACY_M;
    },
  });
}
