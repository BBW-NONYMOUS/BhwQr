"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircleIcon, RefreshCwIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { recomputeAttendanceAction } from "@/app/admin/attendance/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import type { EmployeeOption } from "./manual-entry-dialog";
import { recomputeSchema, type RecomputeInput } from "./schemas";

const ALL = "all";

/**
 * "Recompute statuses" (FR-106): re-applies the schedule, grace period and holidays to the
 * records in a date range, e.g. after a schedule or holiday change.
 */
export function RecomputeDialog({
  defaults,
  employees,
  today,
}: {
  defaults: RecomputeInput;
  employees: EmployeeOption[];
  today: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const form = useForm<RecomputeInput>({ resolver: zodResolver(recomputeSchema), defaultValues: defaults });

  function onOpenChange(next: boolean) {
    if (pending) return;
    if (next) form.reset(defaults);
    setOpen(next);
  }

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const result = await recomputeAttendanceAction(values);
      if (result.ok) {
        toast.success(result.message ?? `Updated ${result.data.count} records.`);
        setOpen(false);
        return;
      }
      form.setError("root", { message: result.message });
      toast.error(result.message);
    });
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <RefreshCwIcon data-icon="inline-start" aria-hidden />
          Recompute statuses
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Recompute statuses</DialogTitle>
          <DialogDescription>
            Re-applies the schedules, grace periods and holidays to the records in this range. Use it after
            changing a schedule or a holiday. Times are not changed.
          </DialogDescription>
        </DialogHeader>
        <form id="recompute-form" onSubmit={onSubmit} noValidate>
          <FieldGroup className="gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              {(["from", "to"] as const).map((name) => (
                <Controller
                  key={name}
                  control={form.control}
                  name={name}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor={`rc-${name}`}>{name === "from" ? "From" : "To"}</FieldLabel>
                      <Input {...field} id={`rc-${name}`} type="date" max={today} aria-invalid={fieldState.invalid} />
                      {fieldState.error ? <FieldError errors={[fieldState.error]} /> : null}
                    </Field>
                  )}
                />
              ))}
            </div>
            <Controller
              control={form.control}
              name="employeeId"
              render={({ field }) => (
                <Field>
                  <FieldLabel htmlFor="rc-employee">Employee</FieldLabel>
                  <Select value={field.value ?? ALL} onValueChange={(v) => field.onChange(v === ALL ? null : v)}>
                    <SelectTrigger id="rc-employee" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>All employees</SelectItem>
                      {employees.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldDescription>The range can be at most one year.</FieldDescription>
                </Field>
              )}
            />
            {form.formState.errors.root ? <FieldError>{form.formState.errors.root.message}</FieldError> : null}
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" form="recompute-form" disabled={pending}>
            {pending ? <LoaderCircleIcon className="animate-spin" data-icon="inline-start" aria-hidden /> : null}
            Recompute
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
