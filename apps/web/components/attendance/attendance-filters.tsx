"use client";

import { ATTENDANCE_METHODS, ATTENDANCE_STATUSES, METHOD_LABELS } from "@bhw/types";
import { statusColors } from "@bhw/design-tokens";
import { format, parseISO } from "date-fns";
import { CalendarIcon, FilterXIcon, LoaderCircleIcon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDate } from "@/lib/format";

import { attendanceFiltersToSearch, defaultRange, type AttendanceFilters } from "./filters";
import type { EmployeeOption } from "./manual-entry-dialog";

const ALL = "all";

/** Filter bar for Attendance Records. Every change is written to the URL (searchParams). */
export function AttendanceFiltersBar({
  filters,
  employees,
  today,
}: {
  filters: AttendanceFilters;
  employees: EmployeeOption[];
  today: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange | undefined>({
    from: parseISO(filters.from),
    to: parseISO(filters.to),
  });

  function apply(next: Partial<AttendanceFilters>) {
    const merged = { ...filters, ...next };
    startTransition(() => router.push(`${pathname}?${attendanceFiltersToSearch(merged)}`));
  }

  function onCalendarOpenChange(open: boolean) {
    if (open) setDraft({ from: parseISO(filters.from), to: parseISO(filters.to) });
    setCalendarOpen(open);
  }

  function applyRange() {
    if (!draft?.from) return;
    const from = format(draft.from, "yyyy-MM-dd");
    const to = format(draft.to ?? draft.from, "yyyy-MM-dd");
    setCalendarOpen(false);
    apply({ from, to });
  }

  const isDefault =
    filters.from === defaultRange(today).from &&
    filters.to === today &&
    !filters.employeeId &&
    !filters.status &&
    !filters.method;

  return (
    <div className="flex flex-wrap items-end gap-3 pb-4 print:hidden" aria-busy={pending}>
      <div className="grid gap-1.5">
        <Label htmlFor="att-range">Date range</Label>
        <Popover open={calendarOpen} onOpenChange={onCalendarOpenChange}>
          <PopoverTrigger asChild>
            <Button id="att-range" variant="outline" className="min-w-60 justify-start font-normal tabular-nums">
              <CalendarIcon data-icon="inline-start" aria-hidden />
              {filters.from === filters.to
                ? formatDate(filters.from)
                : `${formatDate(filters.from)} – ${formatDate(filters.to)}`}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              numberOfMonths={2}
              defaultMonth={draft?.from}
              selected={draft}
              onSelect={setDraft}
              disabled={{ after: parseISO(today) }}
            />
            <div className="flex items-center justify-between gap-2 border-t p-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const r = defaultRange(today);
                  setCalendarOpen(false);
                  apply(r);
                }}
              >
                Last 7 days
              </Button>
              <Button size="sm" onClick={applyRange} disabled={!draft?.from}>
                Apply
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="att-employee">Employee</Label>
        <Select
          value={filters.employeeId ?? ALL}
          onValueChange={(v) => apply({ employeeId: v === ALL ? null : v })}
        >
          <SelectTrigger id="att-employee" className="min-w-52">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All employees</SelectItem>
            {employees.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.full_name}
                {e.bhw_id_number ? ` · ${e.bhw_id_number}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="att-status">Status</Label>
        <Select
          value={filters.status ?? ALL}
          onValueChange={(v) => apply({ status: v === ALL ? null : (v as AttendanceFilters["status"]) })}
        >
          <SelectTrigger id="att-status" className="min-w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            {ATTENDANCE_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {statusColors[s].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="att-method">Method</Label>
        <Select
          value={filters.method ?? ALL}
          onValueChange={(v) => apply({ method: v === ALL ? null : (v as AttendanceFilters["method"]) })}
        >
          <SelectTrigger id="att-method" className="min-w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All methods</SelectItem>
            {ATTENDANCE_METHODS.map((m) => (
              <SelectItem key={m} value={m}>
                {METHOD_LABELS[m]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!isDefault ? (
        <Button variant="ghost" onClick={() => startTransition(() => router.push(pathname))}>
          <FilterXIcon data-icon="inline-start" aria-hidden />
          Reset filters
        </Button>
      ) : null}
      {pending ? (
        <span className="flex items-center gap-1.5 pb-2 text-sm text-muted-foreground" role="status">
          <LoaderCircleIcon className="size-4 animate-spin" aria-hidden />
          Loading…
        </span>
      ) : null}
    </div>
  );
}
