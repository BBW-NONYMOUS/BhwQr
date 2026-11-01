import { PageHeader } from "@/components/page-header";
import { TableSkeleton } from "@/components/states";
import { Skeleton } from "@/components/ui/skeleton";

/** Suspense fallback for the reports pages while the session and report rows load. */
export function ReportsFallback() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Daily, weekly and monthly attendance summaries. Totals are counted from the rows shown."
      />
      <Skeleton className="h-9 w-64" />
      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-9 w-44" />
        <Skeleton className="h-9 w-52" />
        <Skeleton className="h-9 w-40" />
      </div>
      <Skeleton className="h-28 w-full rounded-xl" />
      <TableSkeleton rows={8} />
    </div>
  );
}
