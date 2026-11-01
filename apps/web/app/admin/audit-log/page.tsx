import type { Metadata } from "next";
import { Suspense } from "react";

import { AuditLogTable, type AuditLogRow } from "@/components/monitoring/audit-log-table";
import { LogFilterBar } from "@/components/monitoring/log-filter-bar";
import {
  AUDITED_TABLES,
  LOG_ROW_LIMIT,
  manilaRangeBounds,
  parseAuditLogFilters,
  tableLabel,
} from "@/components/monitoring/log-filters";
import { PageHeader } from "@/components/page-header";
import { ErrorState, TableSkeleton } from "@/components/states";
import { requireProfile } from "@/lib/auth/session";
import { manilaToday } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Audit Log" };

export default function AuditLogPage({ searchParams }: PageProps<"/admin/audit-log">) {
  return (
    <>
      <PageHeader
        title="Audit Log"
        description="Every change to attendance, profiles, devices, corrections, schedules, stations, holidays and settings, plus admin actions with reasons. Read-only; kept for 5 years."
      />
      <Suspense fallback={<TableSkeleton />}>
        <AuditLogData searchParams={searchParams} />
      </Suspense>
    </>
  );
}

const SYSTEM = "System";

async function AuditLogData({ searchParams }: { searchParams: PageProps<"/admin/audit-log">["searchParams"] }) {
  await requireProfile(["admin"]);
  const filters = parseAuditLogFilters(await searchParams, manilaToday());
  const { gte, lt } = manilaRangeBounds(filters.from, filters.to);

  const supabase = await createClient();
  let query = supabase
    .from("audit_logs")
    .select("id, created_at, actor_id, action, table_name, record_id, old_data, new_data")
    .gte("created_at", gte)
    .lt("created_at", lt)
    .order("created_at", { ascending: false })
    .limit(LOG_ROW_LIMIT);
  if (filters.table) query = query.eq("table_name", filters.table);
  if (filters.actor === "system") query = query.is("actor_id", null);
  else if (filters.actor) query = query.eq("actor_id", filters.actor);

  const [logsRes, adminsRes] = await Promise.all([
    query,
    supabase.from("profiles").select("id, full_name").eq("role", "admin").order("full_name"),
  ]);

  // audit_logs.actor_id has no FK (history survives profile deletion), so names are looked up.
  const actorIds = [...new Set((logsRes.data ?? []).map((r) => r.actor_id).filter((id): id is string => id !== null))];
  const admins = adminsRes.data ?? [];
  const missing = actorIds.filter((id) => !admins.some((a) => a.id === id));
  const extraRes = missing.length
    ? await supabase.from("profiles").select("id, full_name").in("id", missing)
    : { data: [], error: null };
  const names = new Map<string, string>([...admins, ...(extraRes.data ?? [])].map((p) => [p.id, p.full_name]));

  const actorOptions = [
    { value: "system", label: SYSTEM },
    ...[...names.entries()]
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([id, name]) => ({ value: id, label: name })),
  ];
  if (filters.actor && filters.actor !== "system" && !names.has(filters.actor)) {
    actorOptions.push({ value: filters.actor, label: "Deleted user" });
  }
  const tables = [...new Set<string>([...AUDITED_TABLES, ...(filters.table ? [filters.table] : [])])].sort();

  const filterBar = (
    <LogFilterBar
      key={`${filters.from}|${filters.to}`}
      from={filters.from}
      to={filters.to}
      selects={[
        {
          param: "table",
          label: "Table",
          allLabel: "All tables",
          value: filters.table,
          options: tables.map((t) => ({ value: t, label: tableLabel(t) })),
        },
        {
          param: "actor",
          label: "Actor",
          allLabel: "Everyone",
          value: filters.actor,
          options: actorOptions,
        },
      ]}
    />
  );

  if (logsRes.error || adminsRes.error || extraRes.error) {
    return (
      <div className="space-y-4">
        {filterBar}
        <ErrorState message="The audit log could not be loaded. Please refresh the page." />
      </div>
    );
  }

  const rows: AuditLogRow[] = logsRes.data.map((r) => ({
    id: r.id,
    createdAt: r.created_at,
    actorId: r.actor_id,
    actorName: r.actor_id ? (names.get(r.actor_id) ?? "Deleted user") : SYSTEM,
    action: r.action,
    tableName: r.table_name,
    recordId: r.record_id,
    oldData: r.old_data,
    newData: r.new_data,
  }));

  return (
    <div className="space-y-4">
      {filterBar}
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {rows.length === LOG_ROW_LIMIT
          ? `Showing the newest ${LOG_ROW_LIMIT.toLocaleString("en-PH")} entries in this range (the limit). Narrow the dates or filters to see older ones.`
          : `${rows.length.toLocaleString("en-PH")} entr${rows.length === 1 ? "y" : "ies"} in this range (newest ${LOG_ROW_LIMIT.toLocaleString("en-PH")} at most; times in Manila).`}
      </p>
      <AuditLogTable rows={rows} fileName={`audit-log-${filters.from}-to-${filters.to}`} />
    </div>
  );
}
