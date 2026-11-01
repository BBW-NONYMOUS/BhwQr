import type { LucideIcon } from "lucide-react";
import { ChevronRightIcon, ClipboardCheckIcon, ShieldAlertIcon, UserCheckIcon, WifiOffIcon } from "lucide-react";
import Link from "next/link";

import { loadDashboardToday } from "@/components/dashboard/queries";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface AlertSpec {
  key: string;
  title: string;
  count: number;
  href: string;
  icon: LucideIcon;
  /** Critical alerts use destructive tokens when non-zero; others use the brand accent. */
  critical: boolean;
  active: string;
  idle: string;
}

/**
 * Admin-only alert row: pending approvals, pending correction requests, offline kiosks and
 * critical errors (24 h). Each card links to the page where the admin acts on it.
 */
export async function AlertCards() {
  const { data } = await loadDashboardToday();
  // The stat cards in the same Suspense boundary already render the error state.
  if (!data) return null;

  const alerts: AlertSpec[] = [
    {
      key: "approvals",
      title: "Pending approvals",
      count: data.pending_registrations,
      href: "/admin/approvals",
      icon: UserCheckIcon,
      critical: false,
      active: "Registrations waiting for review",
      idle: "No registrations waiting",
    },
    {
      key: "corrections",
      title: "Correction requests",
      count: data.pending_corrections,
      href: "/admin/corrections",
      icon: ClipboardCheckIcon,
      critical: false,
      active: "Requests waiting for a decision",
      idle: "No pending requests",
    },
    {
      key: "kiosks",
      title: "Offline kiosks",
      count: data.offline_stations,
      href: "/admin/device-health",
      icon: WifiOffIcon,
      critical: true,
      active: "Missed 3 heartbeats - check Device Health",
      idle: "All active kiosks online",
    },
    {
      key: "errors",
      title: "Critical errors (24 h)",
      count: data.critical_errors_24h,
      href: "/admin/error-logs",
      icon: ShieldAlertIcon,
      critical: true,
      active: "Review in Error Logs",
      idle: "No critical errors",
    },
  ];

  return (
    <section aria-labelledby="alerts-heading">
      <h2 id="alerts-heading" className="sr-only">
        Alerts
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {alerts.map(({ key, title, count, href, icon: Icon, critical, active, idle }) => {
          const on = count > 0;
          const urgent = on && critical;
          return (
            <li key={key}>
              <Link
                href={href}
                className="group block rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                aria-label={`${title}: ${count}. ${on ? active : idle}`}
              >
                <Card
                  size="sm"
                  data-state={urgent ? "critical" : on ? "attention" : "ok"}
                  className={cn(
                    "h-full transition-colors group-hover:bg-accent/50",
                    urgent && "bg-destructive/5 ring-destructive/40",
                    on && !critical && "ring-brand/40",
                  )}
                >
                  <CardHeader className="grid-cols-[auto_1fr_auto] items-center gap-3">
                    <span
                      aria-hidden="true"
                      className={cn(
                        "flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground",
                        urgent && "bg-destructive text-destructive-foreground",
                        on && !critical && "bg-brand text-brand-foreground",
                      )}
                    >
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0">
                      <CardTitle className="flex items-baseline gap-2 text-sm">
                        <span
                          className={cn(
                            "text-2xl font-semibold tabular-nums",
                            urgent && "text-destructive",
                            !on && "text-muted-foreground",
                          )}
                        >
                          {count}
                        </span>
                        <span className="truncate">{title}</span>
                      </CardTitle>
                      <CardDescription className="truncate text-xs">{on ? active : idle}</CardDescription>
                    </div>
                    <ChevronRightIcon
                      className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </CardHeader>
                </Card>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
