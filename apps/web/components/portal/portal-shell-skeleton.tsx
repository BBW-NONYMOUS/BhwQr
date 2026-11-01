import { Skeleton } from "@/components/ui/skeleton";

/** Static placeholder of the portal shell, shown while the session is checked. */
export function PortalShellSkeleton() {
  return (
    <div className="flex min-h-svh" aria-busy="true" aria-label="Loading">
      <div className="hidden w-64 shrink-0 flex-col gap-3 border-r p-4 md:flex">
        <Skeleton className="h-10 w-full" />
        {Array.from({ length: 10 }, (_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
      <div className="flex flex-1 flex-col">
        <div className="h-14 border-b" />
        <div className="space-y-4 p-6">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    </div>
  );
}
