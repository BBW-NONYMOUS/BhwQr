import type { Metadata } from "next";
import { Suspense } from "react";

import { ReportsFallback } from "@/components/reports/reports-fallback";
import { ReportsView } from "@/components/reports/reports-view";

export const metadata: Metadata = { title: "Reports" };

/** Read-only reports for Barangay Management (viewer); admins may open it too. No DTR here. */
export default function ViewerReportsPage({ searchParams }: PageProps<"/viewer/reports">) {
  return (
    <Suspense fallback={<ReportsFallback />}>
      <ReportsView searchParams={searchParams} roles={["viewer", "admin"]} />
    </Suspense>
  );
}
