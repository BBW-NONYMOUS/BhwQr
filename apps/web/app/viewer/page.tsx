import type { Metadata } from "next";
import { Suspense } from "react";

import { PanelCardSkeleton, StatCardsSkeleton } from "@/components/dashboard/dashboard-skeletons";
import { PollingRefresh } from "@/components/dashboard/refresh-controls";
import { StatCardsSection, TodayTableSection, TrendSection } from "@/components/dashboard/sections";
import { PageHeader } from "@/components/page-header";
import { TableSkeleton } from "@/components/states";
import { requireProfile } from "@/lib/auth/session";
import { formatDate, manilaToday } from "@/lib/format";

export const metadata: Metadata = { title: "Dashboard" };

/**
 * Read-only dashboard for Barangay Management. Viewers cannot read scan_attempts and receive no
 * Realtime rows (RLS), so there is no live scan list and the page polls every 30 s instead.
 */
export default async function ViewerDashboardPage(_props: PageProps<"/viewer">) {
  await requireProfile(["viewer", "admin"]);
  const now = new Date();
  const workDate = manilaToday(now);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`Attendance for ${formatDate(workDate)} · read-only · all times in Manila time`}
        actions={<PollingRefresh renderedAt={now.toISOString()} />}
      />
      <div className="space-y-6">
        <Suspense fallback={<StatCardsSkeleton />}>
          <StatCardsSection />
        </Suspense>
        <Suspense fallback={<PanelCardSkeleton />}>
          <TrendSection />
        </Suspense>
        <Suspense fallback={<TableSkeleton rows={6} />}>
          <TodayTableSection workDate={workDate} />
        </Suspense>
      </div>
    </>
  );
}
