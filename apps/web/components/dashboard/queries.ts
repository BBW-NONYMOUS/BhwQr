import "server-only";
import { cache } from "react";

import { fromDbError } from "@/lib/actions";
import { createClient } from "@/lib/supabase/server";

import { toDailyRows, toTrendChartData, type DailyRow, type DashboardToday, type TrendPoint } from "./dashboard-data";

/** Either data or a user-facing catalog message; sections render ErrorState for the latter. */
export type Loaded<T> = { data: T; error: null } | { data: null; error: string };

function failed(error: { message?: string; code?: string }): { data: null; error: string } {
  console.error("dashboard query failed", error);
  return { data: null, error: fromDbError(error).message ?? "The dashboard could not be loaded." };
}

/**
 * get_dashboard_today for this request. Cached so the stat cards and the admin alert row share
 * one round trip. Admin-only counts are 0 for viewers (enforced in SQL).
 */
export const loadDashboardToday = cache(async (): Promise<Loaded<DashboardToday>> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_dashboard_today");
  if (error) return failed(error);
  const today = data?.[0];
  if (!today) return { data: null, error: "Today's summary is not available yet." };
  return { data: today, error: null };
});

export async function loadTrend(days = 7): Promise<Loaded<TrendPoint[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_attendance_trend", { p_days: days });
  if (error) return failed(error);
  return { data: toTrendChartData(data), error: null };
}

export async function loadDailySummary(workDate: string): Promise<Loaded<DailyRow[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_daily_summary", { p_date: workDate });
  if (error) return failed(error);
  return { data: toDailyRows(data), error: null };
}
