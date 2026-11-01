import { TableSkeleton } from "@/components/states";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Placeholder for the six stat cards. */
export function StatCardsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6" aria-hidden="true">
      {Array.from({ length: 6 }, (_, i) => (
        <Card key={i} size="sm">
          <CardHeader className="grid-cols-[1fr_auto] items-center">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="size-8 rounded-lg" />
          </CardHeader>
          <CardContent className="gap-2">
            <Skeleton className="h-8 w-14" />
            <Skeleton className="h-3 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/** Placeholder for a chart or list card body. */
export function PanelSkeleton({ className = "h-72" }: { className?: string }) {
  return <Skeleton className={`w-full ${className}`} aria-hidden="true" />;
}

/** Card-shaped placeholder for the chart / live-scan panels (Suspense fallbacks). */
export function PanelCardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={className} aria-busy="true" aria-label="Loading">
      <CardHeader>
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-56" />
      </CardHeader>
      <CardContent>
        <PanelSkeleton />
      </CardContent>
    </Card>
  );
}

/** Placeholder for the admin alert row. */
export function AlertCardsSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-hidden="true">
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="h-18.5 rounded-xl" />
      ))}
    </div>
  );
}

/** Full-page dashboard placeholder (viewer loading.tsx). */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading dashboard">
      <div className="space-y-2 pb-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <StatCardsSkeleton />
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <PanelSkeleton />
        </CardContent>
      </Card>
      <TableSkeleton rows={6} />
    </div>
  );
}
