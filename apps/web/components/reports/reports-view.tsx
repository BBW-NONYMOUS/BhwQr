import "server-only";

import { statusColors } from "@bhw/design-tokens";
import type { UserRole } from "@bhw/types";

import { PageHeader } from "@/components/page-header";
import { ErrorState } from "@/components/states";
import { fromDbError } from "@/lib/actions";
import { requireProfile } from "@/lib/auth/session";
import { formatDateTime, manilaToday } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

import { DailyReport } from "./daily-report";
import { MonthlyReport } from "./monthly-report";
import { yearOptions } from "./period";
import { PrintButton } from "./print-button";
import { ReportFilters } from "./report-filters";
import { ReportHeader, ReportPrintStyle, ReportSignatures } from "./report-print";
import {
  type DailyReportRow,
  type MonthlyReportRow,
  type ReportParams,
  type WeeklyReportRow,
  parseReportParams,
  reportFileStem,
  reportHeading,
} from "./report-utils";
import { WeeklyReport } from "./weekly-report";

type Supabase = Awaited<ReturnType<typeof createClient>>;

type ReportData =
  | { tab: "daily"; rows: DailyReportRow[] }
  | { tab: "weekly"; rows: WeeklyReportRow[] }
  | { tab: "monthly"; rows: MonthlyReportRow[] }
  | { tab: "error"; message: string };

const FALLBACK_ERROR = "The report could not be loaded. Please try again.";

async function loadReport(supabase: Supabase, p: ReportParams): Promise<ReportData> {
  const area = p.area ?? undefined;
  if (p.tab === "daily") {
    const { data, error } = await supabase.rpc("get_daily_summary", {
      p_date: p.date,
      p_area: area,
      p_status: p.status ?? undefined,
    });
    if (error) return { tab: "error", message: fromDbError(error).message ?? FALLBACK_ERROR };
    return { tab: "daily", rows: data ?? [] };
  }
  if (p.tab === "weekly") {
    const { data, error } = await supabase.rpc("get_weekly_summary", { p_week_start: p.weekStart, p_area: area });
    if (error) return { tab: "error", message: fromDbError(error).message ?? FALLBACK_ERROR };
    return { tab: "weekly", rows: data ?? [] };
  }
  const { data, error } = await supabase.rpc("get_monthly_summary", { p_year: p.year, p_month: p.month, p_area: area });
  if (error) return { tab: "error", message: fromDbError(error).message ?? FALLBACK_ERROR };
  return { tab: "monthly", rows: data ?? [] };
}

/**
 * Areas for the filter, from get_report_areas() (admins and viewers; viewers cannot read profiles).
 * This only fills the dropdown; report totals are always counted from the displayed rows.
 */
async function loadAreas(supabase: Supabase): Promise<string[]> {
  const { data } = await supabase.rpc("get_report_areas");
  const values = (data ?? []).map((r) => r.area);
  return [...new Set(values.filter((a): a is string => !!a && a.trim() !== ""))].sort((a, b) => a.localeCompare(b));
}

async function loadOffice(supabase: Supabase): Promise<{ name: string; address: string }> {
  const { data } = await supabase.from("app_settings").select("office_name, office_address").eq("id", 1).maybeSingle();
  return {
    name: data?.office_name || "Barangay Health Workers Office",
    address: data?.office_address ?? "",
  };
}

/** Request time in Manila, printed under the report title. */
function generatedAtLabel(): string {
  return formatDateTime(new Date().toISOString());
}

function filtersLabel(p: ReportParams): string {
  const parts = [p.area ? `Area: ${p.area}` : "All areas"];
  if (p.tab === "daily") parts.push(p.status ? `Status: ${statusColors[p.status].label}` : "All statuses");
  return parts.join(" · ");
}

/**
 * Daily / Weekly / Monthly attendance reports, shared by /admin/reports and /viewer/reports.
 * Read-only: the only actions are filter changes, CSV export and print.
 */
export async function ReportsView({
  searchParams,
  roles,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  roles: readonly UserRole[];
}) {
  const profile = await requireProfile(roles);
  const sp = await searchParams;
  const today = manilaToday();
  const params = parseReportParams(sp, today);
  const supabase = await createClient();

  const [office, areas, report] = await Promise.all([
    loadOffice(supabase),
    loadAreas(supabase),
    loadReport(supabase, params),
  ]);

  const { title, period } = reportHeading(params);
  const caption = `${title}, ${period}`;
  const fileStem = reportFileStem(params);
  const hasRows = report.tab !== "error" && report.rows.length > 0;

  return (
    <div className="space-y-6 print:space-y-0">
      <ReportPrintStyle orientation={params.tab === "daily" ? "portrait" : "landscape"} />
      <PageHeader
        title="Reports"
        description="Daily, weekly and monthly attendance summaries. Totals are counted from the rows shown."
        actions={<PrintButton disabled={!hasRows} />}
      />
      <ReportFilters params={params} areas={areas} years={yearOptions(today)} today={today} />
      <ReportHeader
        officeName={office.name}
        officeAddress={office.address}
        title={title}
        period={period}
        filters={filtersLabel(params)}
        generatedAt={generatedAtLabel()}
      />

      {report.tab === "error" ? (
        <ErrorState message={report.message} />
      ) : report.tab === "daily" ? (
        <DailyReport rows={report.rows} fileStem={fileStem} caption={caption} />
      ) : report.tab === "weekly" ? (
        <WeeklyReport rows={report.rows} weekStart={params.weekStart} fileStem={fileStem} caption={caption} />
      ) : (
        <MonthlyReport rows={report.rows} fileStem={fileStem} caption={caption} />
      )}

      {hasRows ? <ReportSignatures preparedBy={profile.full_name} /> : null}
    </div>
  );
}
