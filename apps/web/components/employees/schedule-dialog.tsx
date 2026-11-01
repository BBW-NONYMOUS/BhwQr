"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon } from "lucide-react";
import Link from "next/link";
import { useId, useState, useTransition, type ReactNode } from "react";
import { Controller, useForm } from "react-hook-form";

import { approveRegistration } from "@/app/admin/approvals/actions";
import { assignEmployeeSchedule } from "@/app/admin/employees/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { showActionResult } from "./action-feedback";
import { DatePicker } from "./date-picker";
import { scheduleAssignmentSchema, type ScheduleAssignmentInput } from "./employee-helpers";

export interface ScheduleOption {
  id: string;
  name: string;
  /** e.g. "Mon–Fri · 08:00–17:00 · 15 min grace" */
  summary: string;
}

/**
 * Schedule + effective-from dialog used to approve a registration (FR-22, BR-12) and to assign
 * a new schedule to an approved employee (FR-16, D-19).
 */
export function ScheduleDialog({
  purpose,
  employeeId,
  employeeName,
  schedules,
  defaultEffectiveFrom,
  defaultScheduleId,
  trigger,
}: {
  purpose: "approve" | "assign";
  employeeId: string;
  employeeName: string;
  schedules: ScheduleOption[];
  /** Today's Manila date (YYYY-MM-DD), computed on the server. */
  defaultEffectiveFrom: string;
  defaultScheduleId?: string;
  trigger: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const baseId = useId();
  const defaults: ScheduleAssignmentInput = {
    scheduleId: defaultScheduleId ?? (schedules.length === 1 ? schedules[0]!.id : ""),
    effectiveFrom: defaultEffectiveFrom,
  };
  const form = useForm<ScheduleAssignmentInput>({
    resolver: zodResolver(scheduleAssignmentSchema),
    defaultValues: defaults,
  });

  const approving = purpose === "approve";
  const submit = form.handleSubmit((values) => {
    startTransition(async () => {
      const result = approving
        ? await approveRegistration(employeeId, values)
        : await assignEmployeeSchedule(employeeId, values);
      if (!result.ok) {
        if (result.fieldErrors?.scheduleId) form.setError("scheduleId", { message: result.fieldErrors.scheduleId });
        if (result.fieldErrors?.effectiveFrom) {
          form.setError("effectiveFrom", { message: result.fieldErrors.effectiveFrom });
        }
      }
      if (showActionResult(result)) {
        setOpen(false);
        form.reset(defaults);
      }
    });
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        setOpen(next);
        if (!next) form.reset(defaults);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} noValidate className="grid gap-6">
          <DialogHeader>
            <DialogTitle>{approving ? `Approve ${employeeName}` : "Assign schedule"}</DialogTitle>
            <DialogDescription>
              {approving
                ? "Choose the work schedule this employee follows. Their account becomes active and they are notified."
                : `The new schedule applies to ${employeeName} from the chosen date; the current one ends the day before.`}
            </DialogDescription>
          </DialogHeader>

          {schedules.length === 0 ? (
            <Alert>
              <AlertDescription>
                There are no schedules yet.{" "}
                <Link href="/admin/schedules" className="font-medium underline underline-offset-4">
                  Create a schedule
                </Link>{" "}
                first, then come back.
              </AlertDescription>
            </Alert>
          ) : (
            <FieldGroup>
              <Controller
                control={form.control}
                name="scheduleId"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid || undefined}>
                    <FieldLabel htmlFor={`${baseId}-schedule`}>Schedule</FieldLabel>
                    <Select value={field.value || undefined} onValueChange={field.onChange} disabled={pending}>
                      <SelectTrigger
                        id={`${baseId}-schedule`}
                        className="h-11 w-full data-[size=default]:h-11"
                        aria-invalid={fieldState.invalid || undefined}
                        onBlur={field.onBlur}
                      >
                        <SelectValue placeholder="Choose a schedule" />
                      </SelectTrigger>
                      <SelectContent>
                        {schedules.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FieldDescription aria-live="polite">
                      {schedules.find((s) => s.id === field.value)?.summary ?? "Work days, hours and grace period."}
                    </FieldDescription>
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
              <Controller
                control={form.control}
                name="effectiveFrom"
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid || undefined}>
                    <FieldLabel htmlFor={`${baseId}-from`}>Effective from</FieldLabel>
                    <DatePicker
                      id={`${baseId}-from`}
                      value={field.value}
                      onChange={field.onChange}
                      invalid={fieldState.invalid}
                      describedBy={`${baseId}-from-hint`}
                    />
                    <FieldDescription id={`${baseId}-from-hint`}>
                      Attendance from this date (Manila time) is classified with this schedule.
                    </FieldDescription>
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
            </FieldGroup>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" className="h-11" disabled={pending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" className="h-11" disabled={pending || schedules.length === 0}>
              {pending ? <Loader2Icon className="animate-spin" data-icon="inline-start" aria-hidden /> : null}
              {approving ? "Approve" : "Assign schedule"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
