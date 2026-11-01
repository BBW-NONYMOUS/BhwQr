"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircleIcon, ShieldCheckIcon } from "lucide-react";
import { useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";

import { saveManualEntryAction } from "@/app/admin/attendance/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { manualEntryFormSchema, type ManualEntryForm, type ManualEntryFormInput } from "./schemas";

export interface EmployeeOption {
  id: string;
  full_name: string;
  bhw_id_number: string | null;
  status: string;
}

export interface StationOption {
  id: string;
  name: string;
}

const NO_STATION = "__none__";

export interface ManualEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: EmployeeOption[];
  stations: StationOption[];
  /** Manila date (YYYY-MM-DD); work dates after it are not allowed (FR-67). */
  today: string;
  /** "edit" locks employee and work date and prefills the record's times ("Edit times"). */
  mode?: "create" | "edit";
  initial?: Partial<ManualEntryFormInput>;
  /** Shown under the title, e.g. the employee and date being edited. */
  context?: string;
  onSaved?: () => void;
}

/**
 * Manual attendance entry (FR-65): employee, work date, time-in and/or time-out, optional
 * station and a required reason (≥ 10 characters) that is written to the audit log (FR-66).
 * Reused by Attendance Records ("Manual entry", "Edit times") and Fallback Scan.
 * Remount with a new `key` to reset the prefilled values.
 */
export function ManualEntryDialog({
  open,
  onOpenChange,
  employees,
  stations,
  today,
  mode = "create",
  initial,
  context,
  onSaved,
}: ManualEntryDialogProps) {
  const [pending, startTransition] = useTransition();
  const form = useForm<ManualEntryFormInput, unknown, ManualEntryForm>({
    resolver: zodResolver(manualEntryFormSchema),
    defaultValues: {
      employeeId: initial?.employeeId ?? "",
      workDate: initial?.workDate ?? today,
      timeIn: initial?.timeIn ?? null,
      timeOut: initial?.timeOut ?? null,
      reason: initial?.reason ?? "",
      stationId: initial?.stationId ?? null,
    },
  });
  const editing = mode === "edit";

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const result = await saveManualEntryAction(values);
      if (result.ok) {
        toast.success(result.message ?? "Attendance saved.");
        onOpenChange(false);
        onSaved?.();
        return;
      }
      for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
        if (field in form.getValues()) form.setError(field as keyof ManualEntryFormInput, { message });
      }
      form.setError("root", { message: result.message });
      toast.error(result.message);
    });
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit attendance times" : "Manual attendance entry"}</DialogTitle>
          <DialogDescription>
            {context ??
              "Use when the employee could not scan the kiosk or a personal QR. Times are Manila time."}
          </DialogDescription>
        </DialogHeader>

        <form id="manual-entry-form" onSubmit={onSubmit} noValidate>
          <FieldGroup className="gap-4">
            <Controller
              control={form.control}
              name="employeeId"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="me-employee">Employee</FieldLabel>
                  <Select value={field.value} onValueChange={field.onChange} disabled={editing}>
                    <SelectTrigger
                      id="me-employee"
                      className="w-full"
                      aria-invalid={fieldState.invalid}
                      onBlur={field.onBlur}
                    >
                      <SelectValue placeholder="Choose an employee" />
                    </SelectTrigger>
                    <SelectContent>
                      {employees.map((e) => (
                        <SelectItem key={e.id} value={e.id}>
                          {e.full_name}
                          {e.bhw_id_number ? ` · ${e.bhw_id_number}` : ""}
                          {e.status !== "active" ? ` (${e.status})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fieldState.error ? <FieldError errors={[fieldState.error]} /> : null}
                </Field>
              )}
            />

            <Controller
              control={form.control}
              name="workDate"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="me-date">Work date</FieldLabel>
                  <Input
                    {...field}
                    id="me-date"
                    type="date"
                    max={today}
                    disabled={editing}
                    aria-invalid={fieldState.invalid}
                  />
                  {fieldState.error ? <FieldError errors={[fieldState.error]} /> : null}
                </Field>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              {(["timeIn", "timeOut"] as const).map((name) => (
                <Controller
                  key={name}
                  control={form.control}
                  name={name}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid}>
                      <FieldLabel htmlFor={`me-${name}`}>{name === "timeIn" ? "Time-in" : "Time-out"}</FieldLabel>
                      <Input
                        id={`me-${name}`}
                        type="time"
                        className="tabular-nums"
                        value={field.value ?? ""}
                        onChange={(e) => field.onChange(e.target.value === "" ? null : e.target.value)}
                        onBlur={field.onBlur}
                        name={field.name}
                        ref={field.ref}
                        aria-invalid={fieldState.invalid}
                      />
                      {fieldState.error ? <FieldError errors={[fieldState.error]} /> : null}
                    </Field>
                  )}
                />
              ))}
              <FieldDescription className="sm:col-span-2">
                Leave a time blank to keep what is already recorded for that day.
              </FieldDescription>
            </div>

            <Controller
              control={form.control}
              name="stationId"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="me-station">Station (optional)</FieldLabel>
                  <Select
                    value={field.value ?? NO_STATION}
                    onValueChange={(v) => field.onChange(v === NO_STATION ? null : v)}
                  >
                    <SelectTrigger id="me-station" className="w-full" onBlur={field.onBlur}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_STATION}>No station / keep current</SelectItem>
                      {stations.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fieldState.error ? <FieldError errors={[fieldState.error]} /> : null}
                </Field>
              )}
            />

            <Controller
              control={form.control}
              name="reason"
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="me-reason">Reason</FieldLabel>
                  <Textarea
                    {...field}
                    id="me-reason"
                    rows={3}
                    maxLength={500}
                    placeholder="e.g. Kiosk offline 07:30–09:15; time taken from the office logbook"
                    aria-invalid={fieldState.invalid}
                    aria-describedby="me-reason-help"
                  />
                  <FieldDescription id="me-reason-help">
                    At least 10 characters. {field.value.trim().length}/500
                  </FieldDescription>
                  {fieldState.error ? <FieldError errors={[fieldState.error]} /> : null}
                </Field>
              )}
            />

            <Alert>
              <ShieldCheckIcon />
              <AlertDescription>
                This entry is audited: your name, the old and new times and the reason are saved in the Audit
                Log, and the record is marked &ldquo;Manual entry&rdquo;.
              </AlertDescription>
            </Alert>

            {form.formState.errors.root ? <FieldError>{form.formState.errors.root.message}</FieldError> : null}
          </FieldGroup>
        </form>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" form="manual-entry-form" disabled={pending}>
            {pending ? <LoaderCircleIcon className="animate-spin" data-icon="inline-start" aria-hidden /> : null}
            {editing ? "Save times" : "Save entry"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
