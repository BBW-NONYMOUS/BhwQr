import type { Metadata } from "next";
import { Suspense } from "react";

import { ReportsFallback } from "@/components/reports/reports-fallback";
import { ReportsView } from "@/components/reports/reports-view";

export const metadata: Metadata = { title: "Reports" };

export default function AdminReportsPage({ searchParams }: PageProps<"/admin/reports">) {
  return (
    <Suspense fallback={<ReportsFallback />}>
      <ReportsView searchParams={searchParams} roles={["admin"]} />
    </Suspense>
  );
}
