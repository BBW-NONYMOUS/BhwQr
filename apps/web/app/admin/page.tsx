import type { Metadata } from "next";
import { Suspense } from "react";

import {
  AlertCardsSkeleton,
  PanelCardSkeleton,
  StatCardsSkeleton,
} from "@/components/dashboard/dashboard-skeletons";
import { StatCardsSection, TodayTableSection, TrendSection } from "@/components/dashboard/sections";
import { PageHeader } from "@/components/page-header";
import { TableSkeleton } from "@/components/states";
import { requireProfile } from "@/lib/auth/session";
import { formatDate, manilaToday } from "@/lib/format";

import { AlertCards } from "./_dashboard/alert-cards";
import { LiveScans } from "./_dashboard/live-scans";
import { RealtimeRefresh } from "./_dashboard/realtime-refresh";

export const metadata: Metadata = { title: "Dashboard" };

export default async function AdminDashboardPage(_props: PageProps<"/admin">) {
  await requireProfile(["admin"]);
  const workDate = manilaToday();

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`Attendance for ${formatDate(workDate)} · all times in Manila time`}
        actions={<RealtimeRefresh workDate={workDate} />}
      />
      <div className="space-y-6">
        <Suspense
          fallback={
            <div className="space-y-6">
              <StatCardsSkeleton />
              <AlertCardsSkeleton />
            </div>
          }
        >
          <div className="space-y-6">
            <StatCardsSection />
            <AlertCards />
          </div>
        </Suspense>

        <div className="grid gap-6 lg:grid-cols-3">
          <Suspense fallback={<PanelCardSkeleton className="lg:col-span-2" />}>
            <TrendSection className="lg:col-span-2" />
          </Suspense>
          <Suspense fallback={<PanelCardSkeleton />}>
            <LiveScans workDate={workDate} />
          </Suspense>
        </div>

        <Suspense fallback={<TableSkeleton rows={6} />}>
          <TodayTableSection workDate={workDate} />
        </Suspense>
      </div>
    </>
  );
}
