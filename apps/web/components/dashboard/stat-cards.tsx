import type { LucideIcon } from "lucide-react";
import { ClockAlertIcon, LogOutIcon, UserCheckIcon, UserXIcon, UsersIcon, TimerOffIcon } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { percentOf, type DashboardToday } from "./dashboard-data";
import { NumberTicker } from "./number-ticker";

interface StatCardSpec {
  key: string;
  title: string;
  value: number;
  hint: string;
  icon: LucideIcon;
  /** Token classes for the icon chip (status palette, or neutral for totals). */
  tone: string;
}

function specsFor(today: DashboardToday): StatCardSpec[] {
  const total = today.total_employees;
  return [
    {
      key: "present",
      title: "Present",
      value: today.present_count,
      hint: `${today.on_time_count} on time · ${percentOf(today.present_count, total)}% of employees`,
      icon: UserCheckIcon,
      tone: "bg-status-on-time text-status-on-time-foreground",
    },
    {
      key: "late",
      title: "Late",
      value: today.late_count,
      hint: "Timed in after the grace period",
      icon: ClockAlertIcon,
      tone: "bg-status-late text-status-late-foreground",
    },
    {
      key: "absent",
      title: "Absent",
      value: today.absent_count,
      hint: "Marked absent for today",
      icon: UserXIcon,
      tone: "bg-status-absent text-status-absent-foreground",
    },
    {
      key: "undertime",
      title: "Undertime",
      value: today.undertime_count,
      hint: "Timed out before the end of shift",
      icon: TimerOffIcon,
      tone: "bg-status-undertime text-status-undertime-foreground",
    },
    {
      key: "incomplete",
      title: "No time-out",
      value: today.incomplete_count,
      hint: "Timed in without a time-out",
      icon: LogOutIcon,
      tone: "bg-status-incomplete text-status-incomplete-foreground",
    },
    {
      key: "total",
      title: "Total employees",
      value: total,
      hint: `${today.no_record_yet_count} scheduled today, not yet scanned`,
      icon: UsersIcon,
      tone: "bg-brand text-brand-foreground",
    },
  ];
}

/** Today's headline counts from get_dashboard_today (admin and viewer dashboards). */
export function StatCards({ today }: { today: DashboardToday }) {
  return (
    <section aria-labelledby="stat-cards-heading">
      <h2 id="stat-cards-heading" className="sr-only">
        Today&apos;s attendance counts
      </h2>
      <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {specsFor(today).map(({ key, title, value, hint, icon: Icon, tone }) => (
          <li key={key}>
            <Card size="sm" className="h-full">
              <CardHeader className="grid-cols-[1fr_auto] items-center">
                <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
                <span className={cn("flex size-8 items-center justify-center rounded-lg", tone)} aria-hidden="true">
                  <Icon className="size-4" />
                </span>
              </CardHeader>
              <CardContent className="gap-1">
                <NumberTicker value={value} className="text-3xl font-semibold tracking-tight" />
                <CardDescription className="text-xs">{hint}</CardDescription>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}
