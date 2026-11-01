"use client";

import { Loader2Icon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";

import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MONTH_NAMES } from "@/components/reports/period";

export const BATCH_VALUE = "all";

export interface DtrEmployeeOption {
  id: string;
  full_name: string;
  bhw_id_number: string | null;
  inactive: boolean;
}

/** Employee + month pickers for /admin/dtr. Writes ?employee=&year=&month= and lets the server render. */
export function DtrFilters({
  employees,
  employee,
  year,
  month,
  years,
}: {
  employees: DtrEmployeeOption[];
  employee: string | null;
  year: number;
  month: number;
  years: number[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  function navigate(next: { employee?: string | null; year?: number; month?: number }) {
    const params = new URLSearchParams();
    const emp = next.employee === undefined ? employee : next.employee;
    if (emp) params.set("employee", emp);
    params.set("year", String(next.year ?? year));
    params.set("month", String(next.month ?? month));
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  return (
    <div className="flex flex-wrap items-end gap-3 print:hidden" aria-busy={pending}>
      <div className="grid gap-1.5">
        <Label htmlFor="dtr-employee">Employee</Label>
        <Select value={employee ?? undefined} onValueChange={(v) => navigate({ employee: v })}>
          <SelectTrigger id="dtr-employee" className="w-72">
            <SelectValue placeholder="Choose an employee" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={BATCH_VALUE}>All employees (batch)</SelectItem>
            <SelectSeparator />
            {employees.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.full_name}
                {e.bhw_id_number ? ` · ${e.bhw_id_number}` : ""}
                {e.inactive ? " (inactive)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="dtr-month">Month</Label>
        <Select value={String(month)} onValueChange={(v) => navigate({ month: Number(v) })}>
          <SelectTrigger id="dtr-month" className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MONTH_NAMES.map((name, i) => (
              <SelectItem key={name} value={String(i + 1)}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="dtr-year">Year</Label>
        <Select value={String(year)} onValueChange={(v) => navigate({ year: Number(v) })}>
          <SelectTrigger id="dtr-year" className="w-24">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {pending ? (
        <span className="flex h-9 items-center gap-1.5 text-sm text-muted-foreground" role="status">
          <Loader2Icon className="size-4 animate-spin" aria-hidden />
          Loading…
        </span>
      ) : null}
    </div>
  );
}
