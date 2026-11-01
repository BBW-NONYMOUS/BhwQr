import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { type DtrSummary, formatHoursMinutes } from "./dtr-utils";

/**
 * Monthly totals taken from the DTR documents themselves (get_dtr `totals`), so the cards always
 * equal the printed form. For a batch they are the documents' totals added up.
 */
export function DtrSummaryCards({ summary, batch }: { summary: DtrSummary; batch: boolean }) {
  const items: { label: string; value: string; hint?: string; tone?: string }[] = [
    { label: "Days present", value: String(summary.days_present), tone: "bg-status-on-time-foreground" },
    { label: "Days absent", value: String(summary.days_absent), tone: "bg-status-absent-foreground" },
    { label: "Days late", value: String(summary.days_late), tone: "bg-status-late-foreground" },
    { label: "Days undertime", value: String(summary.days_undertime), tone: "bg-status-undertime-foreground" },
    { label: "No time-out", value: String(summary.days_incomplete), tone: "bg-status-incomplete-foreground" },
    {
      label: "Total undertime",
      value: formatHoursMinutes(summary.undertime_total_minutes),
      hint: "hours:minutes, lateness + undertime",
    },
  ];
  return (
    <section aria-label={batch ? `Totals for ${summary.employees} employees` : "Monthly totals"} className="print:hidden">
      {batch ? (
        <p className="pb-2 text-sm text-muted-foreground">
          Totals for {summary.employees} {summary.employees === 1 ? "employee" : "employees"}
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {items.map((item) => (
          <Card key={item.label} className="gap-1 py-4">
            <CardHeader className="px-4">
              <CardDescription className="flex items-center gap-1.5">
                {item.tone ? (
                  <span className={cn("size-2 rounded-full ring-1 ring-border", item.tone)} aria-hidden />
                ) : null}
                {item.label}
              </CardDescription>
              <CardTitle className="text-2xl font-semibold tabular-nums">{item.value}</CardTitle>
              {item.hint ? <p className="text-xs text-muted-foreground">{item.hint}</p> : null}
            </CardHeader>
          </Card>
        ))}
      </div>
    </section>
  );
}
