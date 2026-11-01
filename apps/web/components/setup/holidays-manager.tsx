"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { ColumnDef } from "@tanstack/react-table";
import { CalendarPlusIcon, PlusIcon, SparklesIcon, Trash2Icon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { DataTable } from "@/components/data-table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { ActionResult } from "@/lib/actions";
import { formatDate } from "@/lib/format";

import { applyFieldErrors } from "./form-utils";
import { holidayFormSchema, type HolidayEntry, type HolidayFormValues } from "./holidays";
import { RecomputeButton, RecomputeDialog, type RecomputeAction } from "./recompute-dialog";
import type { RecomputeRange } from "./schedule";

export interface HolidayActions {
  add: (values: HolidayFormValues) => Promise<ActionResult<{ date: string }>>;
  remove: (date: string) => Promise<ActionResult<{ date: string }>>;
  addPreset: (year: number) => Promise<ActionResult<{ added: string[] }>>;
  recompute: RecomputeAction;
}

interface HolidaysManagerProps {
  year: number;
  years: number[];
  today: string;
  holidays: HolidayEntry[];
  /** Preset regular holidays for this year not yet in the table; null when no preset exists. */
  presetMissing: HolidayEntry[] | null;
  actions: HolidayActions;
}

/** The selected year up to today (recomputing future dates changes nothing). */
function defaultYearRange(year: number, today: string): RecomputeRange {
  const to = `${year}-12-31` < today ? `${year}-12-31` : today;
  const from = `${year}-01-01` < to ? `${year}-01-01` : to;
  return { from, to };
}

const weekdayFmt = new Intl.DateTimeFormat("en-PH", { weekday: "long", timeZone: "Asia/Manila" });
const weekdayOf = (date: string) => weekdayFmt.format(new Date(`${date}T12:00:00+08:00`));

export function HolidaysManager({ year, years, today, holidays, presetMissing, actions }: HolidaysManagerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [navigating, startNavigation] = useTransition();
  const [presetPending, startPreset] = useTransition();
  const [addOpen, setAddOpen] = useState(false);
  const [toDelete, setToDelete] = useState<HolidayEntry | null>(null);
  const [recomputeRange, setRecomputeRange] = useState<RecomputeRange | null>(null);

  /** After a change on a past date, offer to recompute the affected range. */
  const offerRecompute = (dates: string[], message: string) => {
    const past = dates.filter((d) => d <= today).sort();
    const first = past[0];
    const last = past[past.length - 1];
    if (first === undefined || last === undefined) {
      toast.success(message);
      return;
    }
    const range = { from: first, to: last };
    toast.success(message, {
      description: "Attendance already recorded on past dates keeps its old status until you recompute.",
      action: { label: "Recompute", onClick: () => setRecomputeRange(range) },
      duration: 10_000,
    });
  };

  const onAddPreset = () =>
    startPreset(async () => {
      const result = await actions.addPreset(year);
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      if (result.data.added.length === 0) toast.info(result.message ?? "Nothing to add.");
      else offerRecompute(result.data.added, result.message ?? "Holidays added.");
    });

  const columns: ColumnDef<HolidayEntry, unknown>[] = [
    {
      accessorKey: "date",
      header: "Date",
      cell: ({ row }) => <span className="font-medium">{formatDate(row.original.date)}</span>,
    },
    {
      id: "weekday",
      accessorFn: (h) => weekdayOf(h.date),
      header: "Day",
      enableSorting: false,
      cell: ({ getValue }) => <span className="text-muted-foreground">{String(getValue())}</span>,
    },
    { accessorKey: "name", header: "Name" },
    {
      id: "actions",
      header: () => <span className="sr-only">Actions</span>,
      enableSorting: false,
      cell: ({ row }) => (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Remove ${row.original.name}`}
            onClick={() => setToDelete(row.original)}
          >
            <Trash2Icon aria-hidden />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="flex items-center gap-2">
          <label htmlFor="holiday-year" className="text-sm font-medium">
            Year
          </label>
          <Select
            value={String(year)}
            onValueChange={(v) => startNavigation(() => router.push(`${pathname}?year=${v}`))}
          >
            <SelectTrigger id="holiday-year" className="w-28" aria-busy={navigating}>
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
        <div className="flex flex-1 flex-wrap items-center gap-2 sm:justify-end">
          {presetMissing ? (
            <Button variant="outline" onClick={onAddPreset} disabled={presetPending || presetMissing.length === 0}>
              <SparklesIcon data-icon="inline-start" aria-hidden />
              {presetMissing.length === 0
                ? `${year} PH regular holidays listed`
                : presetPending
                  ? "Adding…"
                  : `Add ${year} PH regular holidays (${presetMissing.length})`}
            </Button>
          ) : null}
          <RecomputeButton
            action={actions.recompute}
            defaultRange={defaultYearRange(year, today)}
            description="Recalculates statuses with the current holiday list. Absent marks on dates that became holidays are removed."
          />
          <Button onClick={() => setAddOpen(true)}>
            <PlusIcon data-icon="inline-start" aria-hidden />
            Add holiday
          </Button>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={holidays}
        searchPlaceholder="Search holidays"
        emptyTitle={`No holidays for ${year}`}
        emptyDescription={
          presetMissing
            ? `Use “Add ${year} PH regular holidays” for the national list, then add local or special days.`
            : "Add national, local and special non-working days. No absences are marked on these dates."
        }
        csvFileName={`holidays-${year}`}
        csv={[
          { header: "Date", value: (h) => h.date },
          { header: "Day", value: (h) => weekdayOf(h.date) },
          { header: "Name", value: (h) => h.name },
        ]}
      />

      <AddHolidayDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        year={year}
        add={actions.add}
        onAdded={(date, message) => offerRecompute([date], message)}
      />
      <DeleteHolidayDialog
        holiday={toDelete}
        onClose={() => setToDelete(null)}
        remove={actions.remove}
        onRemoved={(date, message) => offerRecompute([date], message)}
      />
      {recomputeRange ? (
        <RecomputeDialog
          action={actions.recompute}
          open
          onOpenChange={(open) => (!open ? setRecomputeRange(null) : undefined)}
          defaultRange={recomputeRange}
          description="Recalculates statuses on the changed holiday dates for every employee."
        />
      ) : null}
    </div>
  );
}

function AddHolidayDialog({
  open,
  onOpenChange,
  year,
  add,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  year: number;
  add: HolidayActions["add"];
  onAdded: (date: string, message: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add holiday</DialogTitle>
          <DialogDescription>
            No absences are marked on holidays, and the DTR shows the holiday name on that day.
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <AddHolidayForm
            year={year}
            add={add}
            onDone={(date, message) => {
              onOpenChange(false);
              if (date && message) onAdded(date, message);
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function AddHolidayForm({
  year,
  add,
  onDone,
}: {
  year: number;
  add: HolidayActions["add"];
  onDone: (date?: string, message?: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const form = useForm<HolidayFormValues>({
    resolver: zodResolver(holidayFormSchema),
    defaultValues: { date: "", name: "" },
  });

  const onSubmit = (values: HolidayFormValues) =>
    startTransition(async () => {
      const result = await add(values);
      if (!result.ok) {
        applyFieldErrors(form.setError, result, ["date", "name"]);
        toast.error(result.message);
        return;
      }
      onDone(result.data.date, result.message ?? "Holiday added.");
    });

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <FieldGroup className="gap-4">
        <Controller
          name="date"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="holiday-date">Date</FieldLabel>
              <Input
                {...field}
                id="holiday-date"
                type="date"
                min={`${year - 1}-01-01`}
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
            </Field>
          )}
        />
        <Controller
          name="name"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="holiday-name">Name</FieldLabel>
              <Input
                {...field}
                id="holiday-name"
                placeholder="Isulan Founding Anniversary"
                autoComplete="off"
                aria-invalid={fieldState.invalid}
              />
              {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
            </Field>
          )}
        />
      </FieldGroup>
      <DialogFooter className="mt-6">
        <Button type="button" variant="outline" onClick={() => onDone()} disabled={pending}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          <CalendarPlusIcon data-icon="inline-start" aria-hidden />
          {pending ? "Adding…" : "Add holiday"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function DeleteHolidayDialog({
  holiday,
  onClose,
  remove,
  onRemoved,
}: {
  holiday: HolidayEntry | null;
  onClose: () => void;
  remove: HolidayActions["remove"];
  onRemoved: (date: string, message: string) => void;
}) {
  const [pending, startTransition] = useTransition();

  const onConfirm = () => {
    if (!holiday) return;
    startTransition(async () => {
      const result = await remove(holiday.date);
      onClose();
      if (!result.ok) {
        toast.error(result.message);
        return;
      }
      onRemoved(result.data.date, result.message ?? "Holiday removed.");
    });
  };

  return (
    <Dialog open={holiday !== null} onOpenChange={(open) => (!open && !pending ? onClose() : undefined)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Remove “{holiday?.name}”?</DialogTitle>
          <DialogDescription>
            {holiday ? `${formatDate(holiday.date)} becomes a regular day again. ` : ""}
            Past absences are not added automatically; recompute or let the end-of-day job handle future dates.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={pending}>
            {pending ? "Removing…" : "Remove holiday"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
