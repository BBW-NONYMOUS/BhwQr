import { FileTextIcon, UsersIcon } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";

import { CscForm48, DtrPrintStyle } from "@/components/dtr/csc-form-48";
import { DtrActions } from "@/components/dtr/dtr-actions";
import { BATCH_VALUE, DtrFilters, type DtrEmployeeOption } from "@/components/dtr/dtr-filters";
import { DtrSummaryCards } from "@/components/dtr/dtr-summary";
import { type DtrDocument, parseDtrBatch, parseDtrDocument, summarizeDocuments } from "@/components/dtr/dtr-utils";
import { PageHeader } from "@/components/page-header";
import { firstParam, monthLabel, parseYearMonth, yearOptions } from "@/components/reports/period";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/states";
import { Skeleton } from "@/components/ui/skeleton";
import { fromDbError } from "@/lib/actions";
import { requireProfile } from "@/lib/auth/session";
import { manilaToday } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "DTR (CSC Form 48)" };

const TITLE = "Daily Time Record";
const DESCRIPTION = "Civil Service Form No. 48 built from attendance records. Print two copies per page or download a PDF.";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function DtrPage({ searchParams }: PageProps<"/admin/dtr">) {
  return (
    <Suspense fallback={<DtrFallback />}>
      <DtrContent searchParams={searchParams} />
    </Suspense>
  );
}

function DtrFallback() {
  return (
    <div className="space-y-6 print:space-y-0">
      <PageHeader title={TITLE} description={DESCRIPTION} />
      <div className="flex gap-3">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-9 w-36" />
        <Skeleton className="h-9 w-24" />
      </div>
      <TableSkeleton rows={10} />
    </div>
  );
}

type LoadResult = { docs: DtrDocument[]; error: null } | { docs: []; error: string };

async function loadDocuments(
  supabase: Awaited<ReturnType<typeof createClient>>,
  employee: string,
  year: number,
  month: number,
): Promise<LoadResult> {
  try {
    if (employee === BATCH_VALUE) {
      const { data, error } = await supabase.rpc("get_dtr_batch", { p_year: year, p_month: month });
      if (error) return { docs: [], error: fromDbError(error).message ?? "Could not load the DTRs." };
      return { docs: parseDtrBatch(data), error: null };
    }
    const { data, error } = await supabase.rpc("get_dtr", { p_employee_id: employee, p_year: year, p_month: month });
    if (error) return { docs: [], error: fromDbError(error).message ?? "Could not load the DTR." };
    return { docs: [parseDtrDocument(data)], error: null };
  } catch {
    return { docs: [], error: "The DTR returned by the server could not be read. Please report this in Error Logs." };
  }
}

async function DtrContent({ searchParams }: Pick<PageProps<"/admin/dtr">, "searchParams">) {
  await requireProfile(["admin"]);
  const sp = await searchParams;
  const today = manilaToday();
  const { year, month } = parseYearMonth(firstParam(sp.year), firstParam(sp.month), today);
  const rawEmployee = firstParam(sp.employee);
  const employee = rawEmployee === BATCH_VALUE || (rawEmployee && UUID_RE.test(rawEmployee)) ? rawEmployee : null;

  const supabase = await createClient();
  const { data: people, error: peopleError } = await supabase
    .from("profiles")
    .select("id, full_name, bhw_id_number, status")
    .eq("role", "employee")
    .in("status", ["active", "inactive"])
    .order("full_name");

  const employees: DtrEmployeeOption[] = (people ?? []).map((p) => ({
    id: p.id,
    full_name: p.full_name,
    bhw_id_number: p.bhw_id_number,
    inactive: p.status === "inactive",
  }));

  const result: LoadResult | null = employee ? await loadDocuments(supabase, employee, year, month) : null;
  const docs = result?.docs ?? [];
  const batch = employee === BATCH_VALUE;
  const period = monthLabel({ year, month });

  return (
    <div className="space-y-6 print:space-y-0">
      <DtrPrintStyle />
      <PageHeader title={TITLE} description={DESCRIPTION} actions={<DtrActions docs={docs} year={year} month={month} />} />

      <DtrFilters employees={employees} employee={employee} year={year} month={month} years={yearOptions(today)} />

      {peopleError ? <ErrorState message={fromDbError(peopleError).message ?? "Could not load employees."} /> : null}

      {!employee ? (
        <EmptyState
          icon={FileTextIcon}
          title="Choose an employee"
          description={`Pick one employee, or "All employees (batch)" to print every DTR for ${period}.`}
        />
      ) : result?.error ? (
        <ErrorState message={result.error} />
      ) : docs.length === 0 ? (
        <EmptyState
          icon={UsersIcon}
          title="No DTRs for this month"
          description={`No employee was active during ${period}.`}
        />
      ) : (
        <>
          <DtrSummaryCards summary={summarizeDocuments(docs)} batch={batch} />
          <div className="space-y-6 print:space-y-0">
            {docs.map((doc, i) => (
              <CscForm48 key={doc.employee.id} doc={doc} pageBreak={i < docs.length - 1} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
