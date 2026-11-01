import { ErrorState } from "@/components/states";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/format";

import { loadDailySummary, loadDashboardToday, loadTrend } from "./queries";
import { RetryButton } from "./refresh-controls";
import { StatCards } from "./stat-cards";
import { TodayTable } from "./today-table";
import { TrendChart } from "./trend-chart";

// Async Server Component sections shared by /admin and /viewer. Each one is wrapped in its own
// Suspense boundary by the page so a slow query never blocks the rest of the dashboard.

export async function StatCardsSection() {
  const { data, error } = await loadDashboardToday();
  if (error !== null) return <ErrorState message={error} action={<RetryButton />} />;
  return <StatCards today={data} />;
}

export async function TrendSection({ className }: { className?: string }) {
  const { data, error } = await loadTrend(7);
  return (
    <Card role="region" className={className} aria-labelledby="trend-heading">
      <CardHeader>
        <CardTitle id="trend-heading" className="font-semibold">
          Last 7 days
        </CardTitle>
        <CardDescription>Attendance records per day by status (Manila time).</CardDescription>
      </CardHeader>
      <CardContent>
        {error !== null ? <ErrorState message={error} action={<RetryButton />} /> : <TrendChart data={data} />}
      </CardContent>
    </Card>
  );
}

export async function TodayTableSection({ workDate }: { workDate: string }) {
  const { data, error } = await loadDailySummary(workDate);
  return (
    <section aria-labelledby="today-table-heading" className="space-y-3">
      <div className="space-y-1">
        <h2 id="today-table-heading" className="text-lg font-semibold tracking-tight">
          Today&apos;s attendance
        </h2>
        <p className="text-sm text-muted-foreground">
          Every active employee for {formatDate(workDate)}, including those not yet scanned.
        </p>
      </div>
      {error !== null ? (
        <ErrorState message={error} action={<RetryButton />} />
      ) : (
        <TodayTable rows={data} workDate={workDate} />
      )}
    </section>
  );
}
