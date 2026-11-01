import { Skeleton } from "@/components/ui/skeleton";

export default function EmployeeDetailLoading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading employee">
      <Skeleton className="h-8 w-28" />
      <div className="space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-[28rem] rounded-xl lg:row-span-2" />
        <Skeleton className="h-52 rounded-xl lg:col-span-2" />
        <Skeleton className="h-52 rounded-xl lg:col-span-2" />
      </div>
      <Skeleton className="h-72 rounded-xl" />
    </div>
  );
}
