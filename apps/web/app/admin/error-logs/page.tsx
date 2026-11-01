import { ERROR_SEVERITIES, ERROR_SOURCES } from "@bhw/types";
import type { Metadata } from "next";
import { Suspense } from "react";

import { ErrorLogsTable, type ErrorLogRow } from "@/components/monitoring/error-logs-table";
import { LogFilterBar } from "@/components/monitoring/log-filter-bar";
import {
  LOG_ROW_LIMIT,
  SEVERITY_LABELS,
  SOURCE_LABELS,
  manilaRangeBounds,
  parseErrorLogFilters,
} from "@/components/monitoring/log-filters";
import { PageHeader } from "@/components/page-header";
import { ErrorState, TableSkeleton } from "@/components/states";
import { requireProfile } from "@/lib/auth/session";
import { manilaToday } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Error Logs" };

export default function ErrorLogsPage({ searchParams }: PageProps<"/admin/error-logs">) {
  return (
    <>
      <PageHeader
        title="Error Logs"
        description="Errors reported by Edge Functions, kiosks, the mobile app and this portal, including kiosk offline alerts and failed jobs. Kept for 180 days."
      />
      <Suspense fallback={<TableSkeleton />}>
        <ErrorLogsData searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function ErrorLogsData({ searchParams }: { searchParams: PageProps<"/admin/error-logs">["searchParams"] }) {
  await requireProfile(["admin"]);
  const filters = parseErrorLogFilters(await searchParams, manilaToday());
  const { gte, lt } = manilaRangeBounds(filters.from, filters.to);

  const supabase = await createClient();
  let query = supabase
    .from("error_logs")
    .select("id, created_at, source, severity, message, context, user_id, user:profiles!error_logs_user_id_fkey(full_name)")
    .gte("created_at", gte)
    .lt("created_at", lt)
    .order("created_at", { ascending: false })
    .limit(LOG_ROW_LIMIT);
  if (filters.source) query = query.eq("source", filters.source);
  if (filters.severity) query = query.eq("severity", filters.severity);
  const { data, error } = await query;

  const filterBar = (
    <LogFilterBar
      key={`${filters.from}|${filters.to}`}
      from={filters.from}
      to={filters.to}
      selects={[
        {
          param: "source",
          label: "Source",
          allLabel: "All sources",
          value: filters.source,
          options: ERROR_SOURCES.map((s) => ({ value: s, label: SOURCE_LABELS[s] })),
        },
        {
          param: "severity",
          label: "Severity",
          allLabel: "All severities",
          value: filters.severity,
          options: [...ERROR_SEVERITIES].reverse().map((s) => ({ value: s, label: SEVERITY_LABELS[s] })),
        },
      ]}
    />
  );

  if (error) {
    return (
      <div className="space-y-4">
        {filterBar}
        <ErrorState message="Error logs could not be loaded. Please refresh the page." />
      </div>
    );
  }

  const rows: ErrorLogRow[] = data.map((e) => ({
    id: e.id,
    createdAt: e.created_at,
    source: e.source,
    severity: e.severity,
    message: e.message,
    context: e.context,
    userName: e.user?.full_name ?? null,
    userId: e.user_id,
  }));

  return (
    <div className="space-y-4">
      {filterBar}
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {rows.length === LOG_ROW_LIMIT
          ? `Showing the newest ${LOG_ROW_LIMIT.toLocaleString("en-PH")} entries in this range. Narrow the dates to see older ones.`
          : `${rows.length.toLocaleString("en-PH")} entr${rows.length === 1 ? "y" : "ies"} in this range (times in Manila).`}
      </p>
      <ErrorLogsTable rows={rows} fileName={`error-logs-${filters.from}-to-${filters.to}`} />
    </div>
  );
}
